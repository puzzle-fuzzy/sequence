import { describe, expect, it } from 'bun:test'
import { validate, sanitize, applyDefaults } from '../src/validate'
import type { ModelConfig } from '../src/types'

const miniConfig: ModelConfig = {
  id: 'test',
  model: 'test',
  supportedModels: ['test'],
  displayName: 'Test',
  category: 'video',
  subCategory: 't2v',
  endpoint: '/test',
  async: true,
  pricing: { unit: 'per_second', quantityKey: 'duration', tiers: [{ condition: {}, price: 1 }] },
  requestType: 'video-t2v',
  parameters: [
    { name: 'prompt', label: '提示词', type: 'text', required: true, maxLength: 100 },
    { name: 'negative_prompt', label: '反向提示词', type: 'text', maxLength: 50 },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1080P', options: [{ label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
    { name: 'duration', label: '时长', type: 'number', defaultValue: 5, min: 2, max: 15 },
    { name: 'watermark', label: '水印', type: 'boolean', defaultValue: false },
    { name: 'seed', label: '种子', type: 'number', min: 0, max: 100 },
  ],
  inputMapping: { prompt: { target: 'prompt' }, resolution: { target: 'parameter' }, duration: { target: 'parameter' } },
}

describe('validate', () => {
  it('passes when all required fields present and valid', () => {
    const r = validate(miniConfig, { prompt: 'a cat', resolution: '720P', duration: 5 })
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })
  it('passes when optional fields omitted', () => {
    expect(validate(miniConfig, { prompt: 'hi' }).valid).toBe(true)
  })
  it('fails when required field missing', () => {
    const r = validate(miniConfig, { duration: 5 })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.field === 'prompt')).toBe(true)
  })
  it('fails when required field is empty string', () => {
    expect(validate(miniConfig, { prompt: '' }).valid).toBe(false)
  })
  it('fails when text exceeds maxLength', () => {
    expect(validate(miniConfig, { prompt: 'x'.repeat(101) }).valid).toBe(false)
  })
  it('fails when text is not a string', () => {
    expect(validate(miniConfig, { prompt: 123 } as Record<string, unknown>).valid).toBe(false)
  })
  it('fails when select value not in options', () => {
    expect(validate(miniConfig, { prompt: 'hi', resolution: '4K' }).valid).toBe(false)
  })
  it('fails when number below min', () => {
    expect(validate(miniConfig, { prompt: 'hi', duration: 1 }).valid).toBe(false)
  })
  it('fails when number above max', () => {
    expect(validate(miniConfig, { prompt: 'hi', duration: 20 }).valid).toBe(false)
  })
  it('fails when boolean is not a boolean', () => {
    expect(validate(miniConfig, { prompt: 'hi', watermark: 'yes' } as Record<string, unknown>).valid).toBe(false)
  })
  it('collects multiple errors', () => {
    const r = validate(miniConfig, { duration: 100, seed: 999, watermark: 'nope' } as Record<string, unknown>)
    expect(r.errors.length).toBeGreaterThanOrEqual(3)
  })
})

describe('sanitize', () => {
  it('strips keys not declared in parameters', () => {
    const r = sanitize(miniConfig, { prompt: 'hi', duration: 5, injected: 'evil' })
    expect(r).toEqual({ prompt: 'hi', duration: 5 })
    expect(r).not.toHaveProperty('injected')
  })
  it('omits declared keys that were not provided', () => {
    expect(sanitize(miniConfig, { prompt: 'hi' })).toEqual({ prompt: 'hi' })
  })
})

describe('applyDefaults', () => {
  it('fills missing optional fields with defaults', () => {
    const r = applyDefaults(miniConfig, { prompt: 'test' })
    expect(r.resolution).toBe('1080P')
    expect(r.duration).toBe(5)
    expect(r.watermark).toBe(false)
  })
  it('preserves user-provided values over defaults', () => {
    const r = applyDefaults(miniConfig, { prompt: 'test', duration: 10, watermark: false })
    expect(r.duration).toBe(10)
    expect(r.watermark).toBe(false)
  })
})
