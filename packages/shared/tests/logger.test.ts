import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { createLogger } from '../src/logger'

// 捕获 console 各方法的调用。用 unknown[] 参数类型避免 mock 调用元组被推断为 []
type Sink = (...args: unknown[]) => void
const sinks: Record<'log' | 'info' | 'warn' | 'error', ReturnType<typeof mock<Sink>>> = {
  log: mock((..._a: unknown[]) => {}),
  info: mock((..._a: unknown[]) => {}),
  warn: mock((..._a: unknown[]) => {}),
  error: mock((..._a: unknown[]) => {}),
}

beforeEach(() => {
  for (const k of ['log', 'info', 'warn', 'error'] as const) {
    console[k] = sinks[k] as never
  }
})

afterEach(() => {
  for (const k of Object.keys(sinks) as (keyof typeof sinks)[]) sinks[k].mockClear()
})

describe('createLogger', () => {
  it('string message: [scope] message, no fields', () => {
    const log = createLogger('app')
    log.info('hello')
    expect(sinks.info).toHaveBeenCalledTimes(1)
    expect(sinks.info.mock.calls[0]![0]).toBe('[app] hello')
  })

  it('pino style: [scope] message + fields object', () => {
    const log = createLogger('w')
    log.info({ workerId: 'w1', port: 3001 }, 'worker started')
    expect(sinks.info).toHaveBeenCalledTimes(1)
    const call = sinks.info.mock.calls[0]!
    expect(call[0]).toBe('[w] worker started')
    expect(call[1]).toEqual({ workerId: 'w1', port: 3001 })
  })

  it('Error object → wrapped in { err }', () => {
    const log = createLogger('w')
    const e = new Error('boom')
    log.error(e)
    expect(sinks.error).toHaveBeenCalledTimes(1)
    const call = sinks.error.mock.calls[0]!
    expect(call[0]).toBe('[w] boom')
    expect((call[1] as { err: { message: string } }).err.message).toBe('boom')
  })

  it('Error + message string uses the message', () => {
    const log = createLogger('w')
    log.error(new Error('x'), 'custom message')
    expect(sinks.error.mock.calls[0]![0]).toBe('[w] custom message')
  })

  it('debug level suppressed by default (minLevel=info)', () => {
    const log = createLogger('app')
    log.debug('noisy')
    expect(sinks.log).not.toHaveBeenCalled()
  })

  it('debug emitted when LOG_LEVEL=debug', () => {
    const prev = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = 'debug'
    const log = createLogger('app')
    log.debug('shown')
    expect(sinks.log).toHaveBeenCalledTimes(1)
    process.env.LOG_LEVEL = prev
  })
})
