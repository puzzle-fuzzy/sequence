type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export interface Logger {
  debug: (msgOrObj: unknown, msg?: unknown, ...args: unknown[]) => void
  info: (msgOrObj: unknown, msg?: unknown, ...args: unknown[]) => void
  warn: (msgOrObj: unknown, msg?: unknown, ...args: unknown[]) => void
  error: (msgOrObj: unknown, msg?: unknown, ...args: unknown[]) => void
}

/**
 * 创建带 scope 的 leveled logger。env LOG_LEVEL 控制阈值。
 *
 * 支持两种调用风格（兼容 pino 约定）：
 *   - logger.info('message')                         单参数：消息
 *   - logger.info({ field: 'v' }, 'message')         pino 风格：结构化字段 + 消息
 *   - logger.error(someError)                        error 对象（自动放 err 字段）
 */
export function createLogger(scope: string, minLevel: LogLevel = 'info'): Logger {
  const threshold = (process.env.LOG_LEVEL as LogLevel | undefined) ?? minLevel
  const min = ORDER[threshold] ?? ORDER.info

  const make = (level: LogLevel) => (first: unknown, second?: unknown, ...rest: unknown[]) => {
    if (ORDER[level] < min) return

    let fields: Record<string, unknown> = {}
    let message: string

    if (typeof first === 'string') {
      // 单参数：logger.info('message')
      message = first
    } else if (first instanceof Error) {
      // error 对象：logger.error(err)
      fields = { err: { name: first.name, message: first.message, stack: first.stack } }
      message = typeof second === 'string' ? second : first.message
    } else if (typeof first === 'object' && first !== null) {
      // pino 风格：logger.info({ field }, 'message')
      fields = first as Record<string, unknown>
      message = typeof second === 'string' ? second : ''
    } else {
      message = String(first)
    }

    const sink = level === 'debug' ? 'log' : level
    if (Object.keys(fields).length > 0) {
      console[sink](`[${scope}] ${message}`, fields, ...rest)
    } else {
      console[sink](`[${scope}] ${message}`, ...rest)
    }
  }

  return { debug: make('debug'), info: make('info'), warn: make('warn'), error: make('error') }
}
