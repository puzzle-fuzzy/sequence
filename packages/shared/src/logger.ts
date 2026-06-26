type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export interface Logger {
  debug: (msg: unknown, ...args: unknown[]) => void
  info: (msg: unknown, ...args: unknown[]) => void
  warn: (msg: unknown, ...args: unknown[]) => void
  error: (msg: unknown, ...args: unknown[]) => void
}

/** 创建带 scope 的 leveled logger。env LOG_LEVEL 控制阈值。 */
export function createLogger(scope: string, minLevel: LogLevel = 'info'): Logger {
  const threshold = (process.env.LOG_LEVEL as LogLevel | undefined) ?? minLevel
  const min = ORDER[threshold] ?? ORDER.info

  const make = (level: LogLevel) => (msg: unknown, ...args: unknown[]) => {
    if (ORDER[level] < min) return
    const payload = typeof msg === 'string' ? msg : { err: msg }
    console[level === 'debug' ? 'log' : level](`[${scope}]`, payload, ...args)
  }

  return { debug: make('debug'), info: make('info'), warn: make('warn'), error: make('error') }
}
