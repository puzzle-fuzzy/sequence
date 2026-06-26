import { describe, expect, it } from 'bun:test'
import { ALL_MODELS } from '../src/modules/generate/registry'
import { assertModelConfigConsistent, type RequestType } from '@seq/bailian-core'

describe('model registry', () => {
  it('contains a non-empty seed set', () => {
    expect(ALL_MODELS.length).toBeGreaterThanOrEqual(5)
  })

  it('every model passes config-consistency self-check', () => {
    // 每个模型自检已在 barrel 加载时执行；这里显式再跑一遍并断言不抛
    for (const m of ALL_MODELS) {
      expect(() => assertModelConfigConsistent(m)).not.toThrow()
    }
  })

  it('covers every requestType (engine contract)', () => {
    const types = new Set<RequestType>(ALL_MODELS.map((m) => m.requestType))
    for (const expected of ['video-t2v', 'video-media', 'image', 'audio'] as RequestType[]) {
      expect(types.has(expected)).toBe(true)
    }
  })

  it('every required parameter has an inputMapping entry', () => {
    for (const m of ALL_MODELS) {
      const mapped = new Set(Object.keys(m.inputMapping))
      for (const p of m.parameters) {
        if (p.required) expect(mapped.has(p.name)).toBe(true)
      }
    }
  })

  it('models have unique ids', () => {
    const ids = ALL_MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
