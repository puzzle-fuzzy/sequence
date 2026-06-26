import { describe, expect, it } from 'bun:test'
import { serialize } from '../src/serialize'

describe('serialize', () => {
  it('converts top-level Date to ISO string', () => {
    const d = new Date('2026-06-26T00:00:00.000Z')
    expect(serialize(d) as unknown as string).toBe('2026-06-26T00:00:00.000Z')
  })

  it('recursively converts Date in nested objects', () => {
    const input = {
      id: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      nested: { at: new Date('2026-02-02T00:00:00.000Z') },
    }
    expect(serialize(input) as unknown as Record<string, unknown>).toEqual({
      id: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      nested: { at: '2026-02-02T00:00:00.000Z' },
    })
  })

  it('converts Date inside arrays', () => {
    const input = { items: [new Date('2026-03-03T00:00:00.000Z'), 'keep'] }
    expect(serialize(input)).toEqual({ items: ['2026-03-03T00:00:00.000Z', 'keep'] })
  })

  it('passes through primitives', () => {
    expect(serialize(42)).toBe(42)
    expect(serialize('hi')).toBe('hi')
    expect(serialize(null)).toBeNull()
    expect(serialize(undefined)).toBeUndefined()
  })
})
