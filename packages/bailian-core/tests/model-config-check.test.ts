import { describe, expect, it } from 'bun:test'
import { assertModelConfigConsistent } from '../src/model-config-check'
import type { ModelConfig } from '../src/types'

const base = {
  id: 'm',
  model: 'm',
  supportedModels: ['m'],
  displayName: 'M',
  category: 'video',
  subCategory: 't2v',
  endpoint: '/e',
  async: true,
  pricing: { unit: 'per_second' as const, quantityKey: 'duration', tiers: [{ condition: {}, price: 1 }] },
  requestType: 'video-t2v' as const,
}

describe('assertModelConfigConsistent', () => {
  it('passes when every required parameter has an inputMapping entry', () => {
    const cfg: ModelConfig = {
      ...base,
      parameters: [
        { name: 'prompt', label: 'p', type: 'text', required: true },
        { name: 'duration', label: 'd', type: 'number' },
      ],
      inputMapping: { prompt: { target: 'prompt' }, duration: { target: 'parameter' } },
    }
    expect(() => assertModelConfigConsistent(cfg)).not.toThrow()
  })
  it('throws when a required parameter lacks a mapping', () => {
    const cfg: ModelConfig = {
      ...base,
      parameters: [{ name: 'prompt', label: 'p', type: 'text', required: true }],
      inputMapping: {},
    }
    expect(() => assertModelConfigConsistent(cfg)).toThrow(/prompt/)
  })
  it('passes when optional parameter has no mapping (allowed)', () => {
    const cfg: ModelConfig = {
      ...base,
      parameters: [{ name: 'note', label: 'n', type: 'text' }],
      inputMapping: {},
    }
    expect(() => assertModelConfigConsistent(cfg)).not.toThrow()
  })
})
