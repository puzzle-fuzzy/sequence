/** 百炼 API 连接配置 */
export interface BailianClientConfig {
  apiKey: string
  baseUrl?: string
}

export const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'

/** 步骤1 创建任务成功响应（异步） */
export interface CreateTaskOutput {
  task_id: string
  task_status: string
}

export interface CreateTaskResponse {
  output: CreateTaskOutput
  request_id: string
}

/** API 错误响应 */
export interface ApiErrorResponse {
  code: string
  message: string
  request_id: string
}

/** 步骤2 查询任务的通用 output（video_url/results 等字段） */
export interface QueryTaskOutput {
  task_id?: string
  task_status?: string
  video_url?: string
  results?: Array<{ url?: string; b64_image?: string }>
  video_duration?: number
  duration?: number
  code?: string
  message?: string
  [key: string]: unknown
}

export interface QueryTaskResponse {
  output: QueryTaskOutput
  request_id: string
  usage?: Record<string, unknown>
}
