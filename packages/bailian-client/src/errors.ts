// 百炼 API 错误码 → 中文提示（从 v1 @uhyc/bailian 移植）

const ERROR_MAP: Record<string, string> = {
  InvalidApiKey: 'API Key 无效或格式错误，请检查 BAILIAN_API_KEY 配置',
  AccessDenied: '当前 API Key 没有权限调用该模型，请在百炼控制台开通',
  Arrearage: '账号欠费，请前往阿里云费用中心充值',
  'Model.AccessDenied': '无权限访问该模型，请在百炼控制台申请权限',
  ModelNotFound: '模型不存在或已下线',
  Throttling: '请求过于频繁触发限流，请稍后重试',
  'Throttling.RateQuota': '调用频率超限，请降低请求频率后重试',
  'Throttling.AllocationQuota': '配额不足，请在百炼控制台提升配额',
  InternalError: '百炼服务内部错误，请稍后重试',
  'DataInspectionFailed': '输入内容包含疑似敏感信息，已被内容安全拦截',
  InvalidParameter: '请求参数不合法',
  BadRequest: '请求格式不正确',
  UnsupportedOperation: '不支持的操作',
  'InvalidFile.Format': '文件格式不支持',
  'InvalidFile.Size': '文件大小超出限制',
  'InvalidURL': '文件 URL 无效或无法访问',
  'InvalidImage.Format': '图片格式不支持',
}

const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/does not support asynchronous/i, '当前模型不支持异步调用'],
  [/does not support synchronous/i, '当前模型不支持同步调用'],
  [/access denied.*account.*good standing/i, '账号欠费或状态异常'],
  [/model.*not.*exist/i, '模型不存在'],
  [/file.*too large/i, '文件大小超出限制'],
  [/download.*fail/i, '文件下载失败，请检查 URL 是否可公开访问'],
  [/quota.*exceeded/i, '配额不足'],
  [/rate.*limit/i, '请求频率超限，请稍后重试'],
  [/timeout/i, '请求超时，请检查网络连接后重试'],
  [/content.*illegal/i, '输入内容不合规，已被内容安全拦截'],
]

/** 将百炼错误码+消息翻译为中文提示。匹配顺序：消息关键词 → 错误码 → 原文。 */
export function translateBailianError(code: string, message: string, requestId?: string): string {
  const rid = requestId ? `（请求 ID: ${requestId}）` : ''
  for (const [pattern, hint] of MESSAGE_PATTERNS) {
    if (pattern.test(message)) return `${hint}${rid}`
  }
  const known = ERROR_MAP[code]
  if (known) {
    const detail = message ? `：${message}` : ''
    return `${known}${detail}${rid}`
  }
  return `[${code}] ${message}${rid}`
}

/** 从百炼 API 响应对象中提取错误并翻译。 */
export function formatBailianError(err: { code?: string; message?: string; request_id?: string }): string {
  return translateBailianError(err.code || 'UnknownError', err.message || '未知错误', err.request_id)
}
