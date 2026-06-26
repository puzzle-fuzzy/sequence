import type { Task } from '@seq/db'
import { upsertStep, findProjectById, findStepsByProject } from '@seq/db'
import { runAsr, chatMultimodal, type AsrResult } from '@seq/bailian-client'
import { TaskInputError } from '@seq/task-engine'
import { createLogger } from '@seq/shared'
import type { WorkerContext } from '../context'

const logger = createLogger('worker:analysis')

const LLM_MODEL = 'qwen-vl-plus'

interface AnalysisTaskInput {
  projectId?: string
  step?: string
  videoUrl?: string
  stepRowId?: string
}

const VIDEO_UNDERSTAND_PROMPT =
  '请详细描述这个视频的内容，包括场景变化、人物动作、对话内容等，按照时间顺序生成完整的剧本格式。包含场景标题、人物、动作描述和对话。'

const buildMergePrompt = (asrText: string, sceneScript: string) =>
  `你有一个视频的语音识别文本和场景分析剧本，请将它们合并为一个格式化的专业视频脚本。

语音识别文本（含时间戳）：
${asrText}

场景分析剧本：
${sceneScript}

请输出格式化的专业脚本，包含：
1. 场景标题和编号
2. 人物描述
3. 动作和镜头描述
4. 对话内容（带时间戳）

使用专业剧本格式，中英文均可。`

/**
 * analysis.asr：调 Paraformer ASR 转写视频音频 → { text, srt, sentences }
 * analysis.script：读上一步 ASR 结果 → qwen-vl-plus 视频理解 + 合并剧本
 *
 * 两步是独立 task（前端一步步调用），不是 v1 的整体管线。
 */
export async function handleAnalysis(task: Task, ctx: WorkerContext): Promise<Record<string, unknown>> {
  const input = task.input as AnalysisTaskInput
  if (!input.projectId || !input.step) {
    throw new TaskInputError('analysis task 缺少 projectId/step')
  }
  const project = await findProjectById(input.projectId)
  if (!project) throw new TaskInputError(`project ${input.projectId} 不存在`)

  const step = input.step as 'asr' | 'script'
  const videoUrl = input.videoUrl ?? project.videoUrl

  if (step === 'asr') {
    return handleAsrStep(ctx, input.projectId, step, videoUrl)
  }
  if (step === 'script') {
    return handleScriptStep(ctx, input.projectId, step, videoUrl)
  }
  throw new TaskInputError(`未知 analysis step: ${step}`)
}

/** ASR 步骤：runAsr → 存 { text, srt, sentences } */
async function handleAsrStep(ctx: WorkerContext, projectId: string, step: 'asr', videoUrl: string): Promise<Record<string, unknown>> {
  logger.info({ projectId, videoUrl }, 'ASR step: starting transcription')
  const result: AsrResult = await runAsr(ctx.bailian, videoUrl, {
    intervalMs: 5000,
    maxAttempts: 60,
    params: { diarization_enabled: true, language_hints: ['zh', 'en'] },
    onProgress: (status, attempt) => logger.info({ projectId, status, attempt }, 'ASR polling'),
  })
  await upsertStep(projectId, step, { status: 'succeeded', result: { text: result.text, srt: result.srt, sentenceCount: result.sentences.length, sentences: result.sentences } })
  logger.info({ projectId, sentenceCount: result.sentences.length }, 'ASR step: succeeded')
  return { text: result.text, srt: result.srt, sentenceCount: result.sentences.length }
}

/** Script 步骤：读 ASR 结果 → 视频理解 → 合并剧本 */
async function handleScriptStep(ctx: WorkerContext, projectId: string, step: 'script', videoUrl: string): Promise<Record<string, unknown>> {
  // 读上一步 ASR 结果
  const steps = await findStepsByProject(projectId)
  const asrStep = steps.find((s) => s.step === 'asr')
  if (!asrStep || asrStep.status !== 'succeeded' || !asrStep.result) {
    throw new TaskInputError('script 步骤依赖 ASR 结果，但 ASR 步骤未完成。请先执行 ASR 步骤。')
  }
  const asrResult = asrStep.result as { text: string; srt: string }

  // 步骤 A：视频理解（qwen-vl-plus + video 输入）
  logger.info({ projectId }, 'script step: video understanding')
  const understand = await chatMultimodal(ctx.bailian, {
    model: LLM_MODEL,
    content: [{ video: videoUrl }, { text: VIDEO_UNDERSTAND_PROMPT }],
  })

  // 步骤 B：合并剧本（qwen-vl-plus + text 输入）
  logger.info({ projectId }, 'script step: merging script')
  const merged = await chatMultimodal(ctx.bailian, {
    model: LLM_MODEL,
    content: [{ text: buildMergePrompt(asrResult.text, understand.text) }],
  })

  await upsertStep(projectId, step, {
    status: 'succeeded',
    result: { script: merged.text, sceneAnalysis: understand.text, asrText: asrResult.text },
  })
  logger.info({ projectId }, 'script step: succeeded')
  return { script: merged.text, sceneAnalysis: understand.text }
}
