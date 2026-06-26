import { treaty } from '@elysia/eden'
import type { App } from '@seq/api'

/**
 * Eden treaty client — 端到端类型安全的 API 调用。
 *
 * 路由在 /api 下，Vite proxy 把 /api/* 转发到后端 :3000（同源，cookie 鉴权）。
 * 第一个参数是 domain（基础 URL），类型参数 App 来自后端 export type App。
 */
export const api = treaty<App>('/api')

/**
 * 从 Eden 响应 { data, error } 提取 data，或抛结构化错误。
 * 401/403 错误会被 useAuth 捕获清理登录态。
 */
export function unwrap<T>(res: { data: T | null; error: { status: number; value: unknown } | null }): T {
  if (res.error) {
    const e = res.error as { status: number; value: unknown }
    throw Object.assign(new Error(`HTTP ${e.status}`), { status: e.status, body: e.value })
  }
  return res.data as T
}
