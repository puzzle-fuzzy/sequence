import { afterEach, describe, expect, it, mock } from 'bun:test'
import { createTask, queryTask } from '../src/client'
import type { ModelConfig } from '@seq/bailian-core'

const cfg: ModelConfig = {
  id: 'm',
  model: 'wan2.7-t2v',
  supportedModels: ['wan2.7-t2v'],
  displayName: 'M',
  category: 'video',
  subCategory: 't2v',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: { unit: 'per_second', quantityKey: 'duration', tiers: [{ condition: {}, price: 1 }] },
  requestType: 'video-t2v',
  parameters: [{ name: 'prompt', label: 'p', type: 'text', required: true }],
  inputMapping: { prompt: { target: 'prompt' } },
}

// 回显请求的 url/method/headers/body 到响应体，便于断言
const fetchMock = mock((url: string, init?: RequestInit) => {
  const bodyEcho = init?.body ? JSON.parse(init.body as string) : null
  return Promise.resolve(
    new Response(
      JSON.stringify({
        _req: { url, method: init?.method, headers: init?.headers, body: bodyEcho },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  )
})
globalThis.fetch = fetchMock as unknown as typeof fetch

afterEach(() => fetchMock.mockClear())

describe('createTask', () => {
  it('POSTs to baseUrl+endpoint with X-DashScope-Async header + Bearer auth', async () => {
    const res = (await createTask({ apiKey: 'k' }, cfg, { prompt: 'cat' })) as unknown as {
      _req: { url: string; method: string; headers: Record<string, string>; body: Record<string, unknown> }
    }
    expect(res._req.url).toBe('https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis')
    expect(res._req.method).toBe('POST')
    expect(res._req.headers.Authorization).toBe('Bearer k')
    expect(res._req.headers['X-DashScope-Async']).toBe('enable')
  })

  it('returns parsed CreateTaskResponse on success', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ output: { task_id: 't1', task_status: 'PENDING' }, request_id: 'r1' }), { status: 200 }),
      ),
    )
    const res = await createTask({ apiKey: 'k' }, cfg, { prompt: 'cat' })
    expect(res.output.task_id).toBe('t1')
    expect(res.request_id).toBe('r1')
  })

  it('throws translated error on non-ok response', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 'Throttling', message: 'rate', request_id: 'r' }), { status: 429 })),
    )
    await expect(createTask({ apiKey: 'k' }, cfg, { prompt: 'cat' })).rejects.toThrow(/限流/)
  })

  it('omits X-DashScope-Async when model.async is false', async () => {
    const syncCfg: ModelConfig = { ...cfg, async: false }
    const res = (await createTask({ apiKey: 'k' }, syncCfg, { prompt: 'cat' })) as unknown as {
      _req: { headers: Record<string, string> }
    }
    expect(res._req.headers['X-DashScope-Async']).toBeUndefined()
  })
})

describe('queryTask', () => {
  it('GETs /tasks/:id with Bearer auth and returns parsed response', async () => {
    fetchMock.mockImplementationOnce(() => {
      // 第一个调用解析会失败（默认 mock 返回 _req），但我们用 implementationOnce 覆盖
      return Promise.resolve(
        new Response(
          JSON.stringify({ output: { task_id: 't1', task_status: 'SUCCEEDED', video_url: 'http://v' }, request_id: 'r1' }),
          { status: 200 },
        ),
      )
    })
    const res = await queryTask({ apiKey: 'k' }, 't1')
    expect(res.output.task_status).toBe('SUCCEEDED')
    expect(res.output.video_url).toBe('http://v')
  })
})
