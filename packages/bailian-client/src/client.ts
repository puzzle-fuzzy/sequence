import type { ModelConfig } from '@seq/bailian-core'
import { buildRequestBody } from './request-builder'
import { formatBailianError } from './errors'
import {
  DEFAULT_BASE_URL,
  type BailianClientConfig,
  type CreateTaskResponse,
  type QueryTaskResponse,
  type ApiErrorResponse,
} from './types'

function postHeaders(apiKey: string, asyncApi: boolean): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  if (asyncApi) h['X-DashScope-Async'] = 'enable'
  return h
}

/** 步骤1：创建任务（异步返回 task_id，或同步直接返回结果）。 */
export async function createTask(
  config: BailianClientConfig,
  model: ModelConfig,
  params: Record<string, unknown>,
): Promise<CreateTaskResponse> {
  const base = config.baseUrl ?? DEFAULT_BASE_URL
  const url = `${base}${model.endpoint}`
  const body = buildRequestBody(model, params)

  const res = await fetch(url, {
    method: 'POST',
    headers: postHeaders(config.apiKey, model.async),
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(formatBailianError(json as ApiErrorResponse))
  }
  return json as CreateTaskResponse
}

/** 步骤2：查询异步任务状态与结果。 */
export async function queryTask(config: BailianClientConfig, taskId: string): Promise<QueryTaskResponse> {
  const base = config.baseUrl ?? DEFAULT_BASE_URL
  const url = `${base}/tasks/${encodeURIComponent(taskId)}`
  const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${config.apiKey}` } })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(formatBailianError(json as ApiErrorResponse))
  }
  return json as QueryTaskResponse
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export interface PollOptions {
  intervalMs?: number
  maxAttempts?: number
  onProgress?: (status: string | undefined, attempt: number) => void
}

/** 轮询直到任务终态（成功/失败/取消/未知）。 */
export async function waitForCompletion(
  config: BailianClientConfig,
  taskId: string,
  options: PollOptions = {},
): Promise<QueryTaskResponse> {
  const { intervalMs = 15000, maxAttempts = 40, onProgress } = options
  const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELED', 'UNKNOWN'])

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await queryTask(config, taskId)
    const status = result.output.task_status
    onProgress?.(status, attempt)
    if (!status || terminal.has(status)) return result
    if (attempt < maxAttempts) await sleep(intervalMs)
  }
  throw new Error(`任务 ${taskId} 在 ${maxAttempts} 次轮询后仍未完成`)
}
