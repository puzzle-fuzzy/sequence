import { describe, expect, it } from 'bun:test'
import { applyMappings, buildRequestBody } from '../src/request-builder'
import type { ModelConfig, InputMapping } from '@seq/bailian-core'

const baseCfg: Pick<ModelConfig, 'id' | 'model' | 'supportedModels' | 'displayName' | 'category' | 'subCategory' | 'endpoint' | 'async' | 'pricing'> = {
  id: 'm',
  model: 'wan2.7-t2v',
  supportedModels: ['wan2.7-t2v'],
  displayName: 'M',
  category: 'video',
  subCategory: 't2v',
  endpoint: '/e',
  async: true,
  pricing: { unit: 'per_second', quantityKey: 'duration', tiers: [{ condition: {}, price: 1 }] },
}

describe('applyMappings', () => {
  const mapping: Record<string, InputMapping> = {
    prompt: { target: 'prompt' },
    duration: { target: 'parameter' },
    negative_prompt: { target: 'mediaField', field: 'negative_prompt' },
    ref: { target: 'media', mediaType: 'reference_image' },
    skip: { target: 'ignored' },
  }
  it('routes prompt → input.prompt', () => {
    expect(applyMappings({ prompt: 'hi' }, mapping).input).toEqual({ prompt: 'hi' })
  })
  it('routes parameter → parameters[name]', () => {
    expect(applyMappings({ duration: 5 }, mapping).parameters).toEqual({ duration: 5 })
  })
  it('routes mediaField → input[field]', () => {
    expect(applyMappings({ negative_prompt: 'bad' }, mapping).input).toEqual({ negative_prompt: 'bad' })
  })
  it('routes media → media[{type,url}]', () => {
    expect(applyMappings({ ref: 'http://x' }, mapping).media).toEqual([{ type: 'reference_image', url: 'http://x' }])
  })
  it('ignores target=ignored', () => {
    const r = applyMappings({ skip: 'x' }, mapping)
    expect(r.input).toEqual({})
    expect(r.media).toEqual([])
  })
  it('skips empty string and null/undefined', () => {
    const r = applyMappings({ prompt: '', duration: null }, mapping)
    expect(r.input).toEqual({})
    expect(r.parameters).toEqual({})
  })
})

describe('buildRequestBody', () => {
  it('video-t2v: flat input + parameters', () => {
    const cfg: ModelConfig = { ...baseCfg, requestType: 'video-t2v', parameters: [], inputMapping: { prompt: { target: 'prompt' }, duration: { target: 'parameter' } } }
    expect(buildRequestBody(cfg, { prompt: 'cat', duration: 5 })).toEqual({
      model: 'wan2.7-t2v',
      input: { prompt: 'cat' },
      parameters: { duration: 5 },
    })
  })
  it('video-media: media merged into input.media', () => {
    const cfg: ModelConfig = { ...baseCfg, requestType: 'video-media', parameters: [], inputMapping: { prompt: { target: 'prompt' }, first_frame: { target: 'media', mediaType: 'first_frame' } } }
    const body = buildRequestBody(cfg, { prompt: 'cat', first_frame: 'http://img' })
    expect(body.input).toMatchObject({ prompt: 'cat', media: [{ type: 'first_frame', url: 'http://img' }] })
  })
  it('image: chat-style messages[].content[].text', () => {
    const cfg: ModelConfig = { ...baseCfg, requestType: 'image', parameters: [], inputMapping: { prompt: { target: 'prompt' }, size: { target: 'parameter' } } }
    const body = buildRequestBody(cfg, { prompt: 'cat', size: '1024*1024' })
    expect(body.input).toEqual({ messages: [{ role: 'user', content: [{ text: 'cat' }] }] })
    expect(body.parameters).toEqual({ size: '1024*1024' })
  })
  it('referenceUrls appended when referenceMediaType set', () => {
    const cfg: ModelConfig = { ...baseCfg, requestType: 'video-media', referenceMediaType: 'reference_video', parameters: [], inputMapping: { prompt: { target: 'prompt' } } }
    const body = buildRequestBody(cfg, { prompt: 'x' }, ['http://r1', 'http://r2'])
    expect((body.input as { media: unknown[] }).media).toEqual([
      { type: 'reference_video', url: 'http://r1' },
      { type: 'reference_video', url: 'http://r2' },
    ])
  })
})
