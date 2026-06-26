import { DEFAULT_BASE_URL, type BailianClientConfig, type ApiErrorResponse } from './types'
import { formatBailianError } from './errors'

// ---------------------------------------------------------------------------
// LLM 多模态调用（qwen-vl-plus）— 用于 analysis 的视频理解 + 剧本生成
// 端点: /services/aigc/multimodal-generation/generation（同步）
// ---------------------------------------------------------------------------

export interface MultimodalContent {
  text?: string
  video?: string
  image?: string
}

export interface ChatMultimodalInput {
  model: string
  content: MultimodalContent[]
}

export interface ChatMultimodalResult {
  text: string
  raw: unknown
}

/** 调用 qwen-vl-plus 等多模态模型，返回 choices[0].message.content[0].text。 */
export async function chatMultimodal(
  config: BailianClientConfig,
  input: ChatMultimodalInput,
): Promise<ChatMultimodalResult> {
  const base = config.baseUrl ?? DEFAULT_BASE_URL
  const res = await fetch(`${base}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      input: {
        messages: [{ role: 'user', content: input.content }],
      },
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(formatBailianError(json as ApiErrorResponse))
  const out = json as {
    output?: {
      choices?: Array<{
        message?: { content?: Array<{ text?: string }> }
      }>
    }
  }
  const text = out.output?.choices?.[0]?.message?.content?.[0]?.text ?? ''
  return { text, raw: json }
}
