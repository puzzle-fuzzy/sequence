import { describe, expect, it } from 'bun:test'
import { extractFromQueryOutput, extractFromSyncImage } from '../src/product-extractor'

describe('extractFromQueryOutput', () => {
  it('video → single primary file from video_url', () => {
    const out = extractFromQueryOutput('video', { video_url: 'http://v.mp4' })
    expect(out).toEqual([{ url: 'http://v.mp4', kind: 'primary' }])
  })
  it('video without video_url → empty', () => {
    expect(extractFromQueryOutput('video', {})).toEqual([])
  })
  it('image → multiple files from results[], first is primary', () => {
    const out = extractFromQueryOutput('image', {
      results: [{ url: 'http://1.png' }, { url: 'http://2.png' }, { b64_image: 'x' }],
    })
    expect(out).toEqual([
      { url: 'http://1.png', kind: 'primary' },
      { url: 'http://2.png', kind: 'extra' },
    ])
  })
  it('image skips results without url', () => {
    expect(extractFromQueryOutput('image', { results: [{ b64_image: 'x' }] })).toEqual([])
  })
  it('audio → empty (async fallback)', () => {
    expect(extractFromQueryOutput('audio', {})).toEqual([])
  })
})

describe('extractFromSyncImage', () => {
  it('collects image URLs across choices and messages', () => {
    const out = extractFromSyncImage([
      { message: { content: [{ image: 'http://a.png' }, { text: 'hi' }] } },
      { message: { content: [{ image: 'http://b.png' }] } },
    ] as Array<{ message?: { content?: Array<{ image?: string }> } }>)
    expect(out).toEqual([
      { url: 'http://a.png', kind: 'primary' },
      { url: 'http://b.png', kind: 'extra' },
    ])
  })
  it('returns empty when no images', () => {
    expect(extractFromSyncImage([{ message: { content: [{ text: 'x' }] as unknown as Array<{ image?: string }> } }])).toEqual([])
  })
  it('handles missing message/content', () => {
    expect(extractFromSyncImage([{}])).toEqual([])
  })
})
