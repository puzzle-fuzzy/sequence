import type { InputMapping, ModelConfig } from '@seq/bailian-core'

/** 按 inputMapping 分发每个参数到 input / parameters / media 收集器。 */
export function applyMappings(
  params: Record<string, unknown>,
  inputMapping: Record<string, InputMapping>,
): {
  input: Record<string, unknown>
  parameters: Record<string, unknown>
  media: Array<{ type: string; url: string }>
} {
  const input: Record<string, unknown> = {}
  const parameters: Record<string, unknown> = {}
  const media: Array<{ type: string; url: string }> = []

  for (const [paramName, mapping] of Object.entries(inputMapping)) {
    const value = params[paramName]
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue

    switch (mapping.target) {
      case 'prompt':
        input.prompt = value
        break
      case 'parameter':
        parameters[paramName] = value
        break
      case 'mediaField':
        input[mapping.field] = value
        break
      case 'media':
        media.push({ type: mapping.mediaType, url: value as string })
        break
      case 'ignored':
        break
    }
  }

  return { input, parameters, media }
}

/**
 * 声明式请求体构建 — 按 model.requestType 塑形。
 * 无任何 model-name 分支；新增模型只需编辑其 ModelConfig.requestType + inputMapping。
 */
export function buildRequestBody(
  config: ModelConfig,
  params: Record<string, unknown>,
  referenceUrls?: string[],
): Record<string, unknown> {
  const { input, parameters, media } = applyMappings(params, config.inputMapping)

  // referenceUrls → input.media[]（仅声明了 referenceMediaType 的模型）
  if (referenceUrls?.length && config.referenceMediaType) {
    for (const url of referenceUrls) {
      media.push({ type: config.referenceMediaType, url })
    }
  }

  switch (config.requestType) {
    case 'image':
      return {
        model: config.model,
        input: { messages: [{ role: 'user', content: [{ text: input.prompt || '' }] }] },
        parameters,
      }
    case 'video-t2v':
    case 'video-media': {
      if (media.length > 0) input.media = media
      return { model: config.model, input, parameters }
    }
    case 'audio':
      return { model: config.model, input }
    case 'chat':
    default:
      return {
        model: config.model,
        input: { messages: [{ role: 'user', content: input.prompt || '' }] },
        parameters: { ...parameters, result_format: 'message' },
      }
  }
}
