import { afterEach, describe, expect, it, mock } from 'bun:test'
import { submitAsr, queryAsrTask, fetchTranscription, msToSrtTime } from '../src/asr'

const fetchMock = mock((_url: string, init?: RequestInit) => {
  const body = init?.body ? JSON.parse(init.body as string) : null
  return Promise.resolve(
    new Response(JSON.stringify({ _req: { url: _url, headers: init?.headers, body } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
})
globalThis.fetch = fetchMock as unknown as typeof fetch
afterEach(() => fetchMock.mockClear())

describe('submitAsr', () => {
  it('POSTs to /services/audio/asr/transcription with X-DashScope-Async + paraformer-v2', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify({ output: { task_id: 'asr-1', task_status: 'PENDING' }, request_id: 'r1' }), { status: 200 })),
    )
    const { taskId } = await submitAsr({ apiKey: 'k' }, 'http://audio.wav')
    expect(taskId).toBe('asr-1')
    const call = fetchMock.mock.calls[0]!
    expect(call[0]).toContain('/services/audio/asr/transcription')
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body.model).toBe('paraformer-v2')
    expect(body.input.file_urls).toEqual(['http://audio.wav'])
    expect((call[1] as RequestInit).headers).toMatchObject({ 'X-DashScope-Async': 'enable' })
  })
})

describe('queryAsrTask', () => {
  it('GETs /tasks/:id and extracts transcription_url from first successful subtask', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            output: { task_status: 'SUCCEEDED', results: [{ transcription_url: 'http://t.json', subtask_status: 'SUCCEEDED' }] },
            usage: { duration: 10 },
          }),
          { status: 200 },
        ),
      ),
    )
    const status = await queryAsrTask({ apiKey: 'k' }, 'asr-1')
    expect(status.status).toBe('SUCCEEDED')
    expect(status.transcriptionUrl).toBe('http://t.json')
    expect(status.usage?.duration).toBe(10)
  })

  it('skips failed subtasks', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ output: { task_status: 'SUCCEEDED', results: [{ subtask_status: 'FAILED' }, { transcription_url: 'http://ok.json', subtask_status: 'SUCCEEDED' }] } }),
          { status: 200 },
        ),
      ),
    )
    const status = await queryAsrTask({ apiKey: 'k' }, 'asr-1')
    expect(status.transcriptionUrl).toBe('http://ok.json')
  })
})

describe('fetchTranscription', () => {
  it('parses transcripts[].sentences into AsrResult + builds SRT', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            transcripts: [
              {
                text: 'hello world',
                sentences: [
                  { begin_time: 0, end_time: 1000, text: 'hello', speaker_id: 0 },
                  { begin_time: 1000, end_time: 2000, text: 'world' },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    )
    const result = await fetchTranscription('http://t.json')
    expect(result.text).toBe('hello world')
    expect(result.sentences).toHaveLength(2)
    expect(result.sentences[0]!.speakerId).toBe(0)
    expect(result.srt).toContain('00:00:00,000 --> 00:00:01,000')
    expect(result.srt).toContain('hello')
    expect(result.srt).toContain('00:00:01,000 --> 00:00:02,000')
  })
})

describe('msToSrtTime', () => {
  it('formats ms to HH:MM:SS,mmm', () => {
    expect(msToSrtTime(0)).toBe('00:00:00,000')
    expect(msToSrtTime(1500)).toBe('00:00:01,500')
    expect(msToSrtTime(3661500)).toBe('01:01:01,500')
  })
})
