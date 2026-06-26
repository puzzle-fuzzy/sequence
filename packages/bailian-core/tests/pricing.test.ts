import { describe, expect, it } from 'bun:test'
import { calcPrice, getDefaultUnitPrice } from '../src/pricing'
import type { ModelPricing } from '../src/types'

const pricing: ModelPricing = {
  unit: 'per_second',
  quantityKey: 'duration',
  tiers: [
    { condition: { resolution: '720P' }, price: 0.6 },
    { condition: { resolution: '1080P' }, price: 1.0 },
  ],
}

describe('calcPrice', () => {
  it('matches tier by condition and multiplies by quantity', () => {
    expect(calcPrice(pricing, { resolution: '1080P', duration: 5 })).toBe(5)
    expect(calcPrice(pricing, { resolution: '720P', duration: 10 })).toBe(6)
  })
  it('falls back to first tier when no condition matches', () => {
    expect(calcPrice(pricing, { resolution: '4K', duration: 5 })).toBe(3) // 0.6 * 5
  })
  it('treats missing/non-number quantity as 1', () => {
    expect(calcPrice(pricing, { resolution: '720P' })).toBe(0.6)
  })
})

describe('getDefaultUnitPrice', () => {
  it('returns first tier price', () => {
    expect(getDefaultUnitPrice(pricing)).toBe(0.6)
  })
})
