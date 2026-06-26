import { DEFAULT_BASE_URL, type BailianClientConfig, type ApiErrorResponse } from './types'
import { formatBailianError } from './errors'

// ---------------------------------------------------------------------------
// Paraformer ASR（录音文件识别）— 异步 submit + poll + transcription 解析
// 文档: docs/bailian/Paraformer录音文件识别RESTful.md
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 5000
const MAX_POLLS = 60

export interface AsrSentence {
  begin: number // ms
  end: number // ms
  text: string
  speakerId?: number
}

export interface AsrResult {
  text: string
  srt: string
  sentences: AsrSentence[]
}

export interface AsrTaskStatus {
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN'
  transcriptionUrl?: string
  usage?: { duration?: number }
  errorCode?: string
  errorMessage?: string
}

function asrHeaders(apiKey: string, async: boolean): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  if (async) h['X-DashScope-Async'] = 'enable'
  return h
}

/** 步骤1：提交 ASR 任务（paraformer-v2）。返回 task_id。 */
export async function submitAsr(
  config: BailianClientConfig,
  fileUrl: string,
  params?: { language_hints?: string[]; diarization_enabled?: boolean; speaker_count?: number },
): Promise<{ taskId: string; requestId: string }> {
  const base = config.baseUrl ?? DEFAULT_BASE_URL
  const res = await fetch(`${base}/services/audio/asr/transcription`, {
    method: 'POST',
    headers: asrHeaders(config.apiKey, true),
    body: JSON.stringify({
      model: 'paraformer-v2',
      input: { file_urls: [fileUrl] },
      parameters: { timestamp_alignment_enabled: true, ...params },
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(formatBailianError(json as ApiErrorResponse))
  const out = json as { output: { task_id: string }; request_id: string }
  return { taskId: out.output.task_id, requestId: out.request_id }
}

/** 步骤2：查询 ASR 任务状态。 */
export async function queryAsrTask(config: BailianClientConfig, taskId: string): Promise<AsrTaskStatus> {
  const base = config.baseUrl ?? DEFAULT_BASE_URL
  const res = await fetch(`${base}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${config.apiKey}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(formatBailianError(json as ApiErrorResponse))
  const out = json as {
    output: {
      task_status: string
      results?: Array<{ transcription_url?: string; subtask_status?: string }>
      code?: string
      message?: string
    }
    usage?: { duration?: number }
  }
  const status = (out.output.task_status ?? 'UNKNOWN') as AsrTaskStatus['status']
  // 整体 SUCCEEDED 时取首个成功的 subtask 的 transcription_url
  const okResult = out.output.results?.find((r) => r.subtask_status !== 'FAILED')
  return {
    status,
    transcriptionUrl: okResult?.transcription_url,
    usage: out.usage,
    errorCode: out.output.code,
    errorMessage: out.output.message,
  }
}

/** ms → SRT 时间码 HH:MM:SS,mmm */
export function msToSrtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const millis = ms % 1000
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(millis, 3)}`
}

/** 步骤3：下载并解析 transcription_url 的 JSON → { text, srt, sentences }。 */
export async function fetchTranscription(transcriptionUrl: string): Promise<AsrResult> {
  const res = await fetch(transcriptionUrl)
  if (!res.ok) throw new Error(`下载转写结果失败 (${res.status})`)
  const json = (await res.json()) as {
    transcripts?: Array<{
      text?: string
      sentences?: Array<{ begin_time?: number; end_time?: number; text?: string; speaker_id?: number }>
    }>
  }
  const transcript = json.transcripts?.[0]
  const rawSentences = transcript?.sentences ?? []
  const sentences: AsrSentence[] = rawSentences.map((s) => ({
    begin: s.begin_time ?? 0,
    end: s.end_time ?? 0,
    text: s.text ?? '',
    ...(s.speaker_id !== undefined ? { speakerId: s.speaker_id } : {}),
  }))
  // 构建 SRT
  const srtParts: string[] = []
  sentences.forEach((s, i) => {
    srtParts.push(`${i + 1}\n${msToSrtTime(s.begin)} --> ${msToSrtTime(s.end)}\n${s.text}\n`)
  })
  return {
    text: transcript?.text ?? sentences.map((s) => s.text).join(''),
    srt: srtParts.join('\n'),
    sentences,
  }
}

/** 便捷：submit → poll → fetch（完整 ASR 流程）。 */
export async function runAsr(
  config: BailianClientConfig,
  fileUrl: string,
  opts?: { intervalMs?: number; maxAttempts?: number; params?: Parameters<typeof submitAsr>[2]; onProgress?: (status: string, attempt: number) => void },
): Promise<AsrResult> {
  const { intervalMs = POLL_INTERVAL, maxAttempts = MAX_POLLS, params, onProgress } = opts ?? {}
  const { taskId } = await submitAsr(config, fileUrl, params)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const status = await queryAsrTask(config, taskId)
    onProgress?.(status.status, attempt)

    if (status.status === 'SUCCEEDED' && status.transcriptionUrl) {
      return fetchTranscription(status.transcriptionUrl)
    }
    if (status.status === 'FAILED' || status.status === 'UNKNOWN') {
      throw new Error(`ASR 任务 ${status.status}${status.errorMessage ? `: ${status.errorMessage}` : ''}`)
    }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`ASR 任务 ${taskId} 在 ${maxAttempts} 次轮询后未完成`)
}
