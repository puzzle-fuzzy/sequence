import { afterEach, describe, expect, it, mock } from 'bun:test'
import { chatMultimodal } from '../src/llm'

const fetchMock = mock((_url: string, init?: RequestInit) =>
  Promise.resolve(new Response(JSON.stringify({ ok: true, body: init?.body ? JSON.parse(init.body as string) : null }), { status: 200 })),
)
globalThis.fetch = fetchMock as unknown as typeof fetch
afterEach(() => fetchMock.mockClear())

describe('chatMultimodal', () => {
  it('POSTs messages with video+text content and extracts choices[0].text', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ output: { choices: [{ message: { content: [{ text: '这是视频内容描述' }] } }] } }),
          { status: 200 },
        ),
      ),
    )
    const result = await chatMultimodal({ apiKey: 'k' }, {
      model: 'qwen-vl-plus',
      content: [{ video: 'http://v.mp4' }, { text: '描述这个视频' }],
    })
    expect(result.text).toBe('这是视频内容描述')

    const call = fetchMock.mock.calls[0]!
    expect(call[0]).toContain('/services/aigc/multimodal-generation/generation')
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body.model).toBe('qwen-vl-plus')
    expect(body.input.messages[0].content).toEqual([{ video: 'http://v.mp4' }, { text: '描述这个视频' }])
  })

  it('returns empty string when no choices', async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ output: {} }), { status: 200 })))
    const result = await chatMultimodal({ apiKey: 'k' }, { model: 'qwen-vl-plus', content: [{ text: 'hi' }] })
    expect(result.text).toBe('')
  })

  it('throws translated error on non-ok', async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ code: 'Throttling', message: 'rate', request_id: 'r' }), { status: 429 })))
    await expect(chatMultimodal({ apiKey: 'k' }, { model: 'qwen-vl-plus', content: [{ text: 'hi' }] })).rejects.toThrow(/限流/)
  })
})
