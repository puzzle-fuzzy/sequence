/**
 * 递归把 Date 转 ISO 字符串，用于 DB 行 → API 响应的序列化。
 * 取代路由层各自手写的 serializeXxx。
 */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString() as unknown as T
  if (Array.isArray(value)) return value.map(serialize) as unknown as T
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v)
    }
    return out as unknown as T
  }
  return value
}
