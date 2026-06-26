import { describe, expect, it } from 'bun:test'
import { translateBailianError, formatBailianError } from '../src/errors'

describe('translateBailianError', () => {
  it('translates known error code', () => {
    expect(translateBailianError('Throttling', 'rate')).toContain('限流')
  })
  it('matches message keyword before code', () => {
    expect(translateBailianError('UnknownError', 'request timeout happened')).toContain('超时')
  })
  it('appends request id when provided', () => {
    expect(translateBailianError('Throttling', 'r', 'req-123')).toContain('req-123')
  })
  it('falls back to original for unknown code+message', () => {
    expect(translateBailianError('MysteryCode', 'something odd')).toContain('MysteryCode')
    expect(translateBailianError('MysteryCode', 'something odd')).toContain('something odd')
  })
})

describe('formatBailianError', () => {
  it('extracts code/message/request_id from response object', () => {
    const msg = formatBailianError({ code: 'Arrearage', message: 'no funds', request_id: 'r1' })
    expect(msg).toContain('欠费')
    expect(msg).toContain('r1')
  })
  it('uses UnknownError fallback when code missing', () => {
    expect(formatBailianError({ message: 'weird' })).toContain('UnknownError')
  })
})
