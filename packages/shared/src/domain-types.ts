// ---------------------------------------------------------------------------
// 跨领域类型 — BASE 层，无运行时依赖
// ---------------------------------------------------------------------------

/** 统一任务状态（tasks 表 status 枚举的 TS 镜像） */
export const TASK_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  RETRYING: 'retrying',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS]

/** 任务域 */
export const TASK_DOMAIN = {
  GENERATE: 'generate',
  ANALYSIS: 'analysis',
  TRANSFER: 'transfer',
} as const

export type TaskDomain = (typeof TASK_DOMAIN)[keyof typeof TASK_DOMAIN]

/** 任务错误分类 */
export type TaskErrorCategory = 'provider_error' | 'timeout' | 'validation' | 'system'

/** 任务错误信息（存入 tasks.errorJson） */
export interface TaskErrorInfo {
  category: TaskErrorCategory
  retriable: boolean
  code?: string
  message: string
}

// ---------------------------------------------------------------------------
// Provider 调用结果 — 判别联合，消除 v1 的 'choices' in output 字符串判分支
// ---------------------------------------------------------------------------

export interface TextProviderOutput {
  type: 'text'
  text: string
  raw: unknown
}

export interface ImageProviderOutput {
  type: 'image'
  urls: string[]
  raw: unknown
}

export interface VideoTaskProviderOutput {
  type: 'video_task'
  taskId: string
  status: 'submitted'
  raw: unknown
}

export interface AudioProviderOutput {
  type: 'audio'
  url: string
  durationSeconds: number
  format: string
  raw: unknown
}

export interface TextProviderResult {
  type: 'text'
  success: true
  model: string
  output: TextProviderOutput
}

export interface ImageProviderResult {
  type: 'image'
  success: true
  model: string
  output: ImageProviderOutput
}

export interface VideoTaskProviderResult {
  type: 'video_task'
  success: true
  model: string
  taskId: string
  output: VideoTaskProviderOutput
}

export interface AudioProviderResult {
  type: 'audio'
  success: true
  model: string
  output: AudioProviderOutput
}

export interface FailedProviderResult {
  type: 'failed'
  success: false
  model?: string
  error: string
  code?: string
}

export type ProviderResult =
  | TextProviderResult
  | ImageProviderResult
  | VideoTaskProviderResult
  | AudioProviderResult
  | FailedProviderResult

// ---------------------------------------------------------------------------
// 生成输入参数 — 附着到 generation_records.inputParams JSONB
// ---------------------------------------------------------------------------

/** 生成任务的输入参数（key = ModelConfig.parameters[].name，value = 用户填写值） */
export type GenerationInputParams = Record<string, unknown>
