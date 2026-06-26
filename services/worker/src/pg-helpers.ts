export { createLogger } from '@seq/shared'

/** 检测 PostgreSQL "undefined table" 错误（错误码 42P01）。 */
export function isPgTableNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code =
    (error as { code?: string }).code ??
    (error.cause as { code?: string } | undefined)?.code
  return code === '42P01'
}
