import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@seq/db'
import { setDb, resetDb, updateStatus, addFile, createRecord, createUser } from '@seq/db'
import { handleGenerate } from '../src/handlers/generate'
import { handleAnalysis } from '../src/handlers/analysis'
import type { WorkerContext } from '../src/context'

let pool: Pool
let userId: string

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  setDb(drizzle(pool, { schema: schema.schema }))
  await pool.query("DELETE FROM users WHERE username = 'wtest'")
  userId = (await createUser({ username: 'wtest', email: 'wtest@example.com', password: 'h' })).id
})
afterAll(() => resetDb())
beforeEach(async () => {
  await pool.query('TRUNCATE generation_files, generation_records, tasks, analysis_steps, analysis_projects RESTART IDENTITY CASCADE')
})

// mock bailian-client（避免真实网络调用）
mock.module('@seq/bailian-client', () => ({
  createTask: mock(async (_cfg: unknown, _model: unknown, _params: unknown) => ({
    output: { task_id: 'bailian-1', task_status: 'SUCCEEDED' },
    request_id: 'r1',
  })),
  waitForCompletion: mock(async () => ({
    output: { task_id: 'bailian-1', task_status: 'SUCCEEDED', video_url: 'http://result.mp4' },
    request_id: 'r1',
  })),
  extractFromSyncImage: mock(() => []),
  // ASR mock：返回固定转写结果
  runAsr: mock(async () => ({
    text: '你好世界',
    srt: '1\n00:00:00,000 --> 00:00:02,000\n你好世界\n',
    sentences: [{ begin: 0, end: 2000, text: '你好世界' }],
  })),
  // LLM mock：视频理解 + 合并返回不同文本，按调用顺序区分
  chatMultimodal: mock(async (_cfg: unknown, input: { content: Array<{ text?: string; video?: string }> }) => {
    // 含 video 的调用 = 视频理解；纯 text = 合并
    const hasVideo = input.content.some((c) => c.video)
    return { text: hasVideo ? '【场景分析】开场：城市夜景...' : '【最终剧本】场景1：城市夜景\n旁白：...', raw: {} }
  }),
}))

// fake storage：downloadFromUrl 返回固定结构，不真实下载
function makeFakeCtx(): WorkerContext {
  return {
    config: {
      pollIntervalMs: 5000,
      claimTtlMs: 60000,
      sweepIntervalMs: 300000,
      healthPort: 3098,
      workerId: 'w-test',
      bailian: { apiKey: 'k' },
      storageRoot: './.tmp-test-storage',
    },
    bailian: { apiKey: 'k' },
    storage: {
      downloadFromUrl: async (_subdir: string, url: string) => ({
        storagePath: `${_subdir}/fake.mp4`,
        sourceUrl: url,
        mimeType: 'video/mp4',
        sizeBytes: 100,
        originalFilename: 'fake.mp4',
        buffer: Buffer.from('x'),
      }),
    },
  } as unknown as WorkerContext
}

describe('handleGenerate', () => {
  it('async video: creates task, waits, downloads result, marks record succeeded', async () => {
    const record = await createRecord({
      userId,
      model: 'wan2.7-t2v',
      category: 'video',
      subCategory: 'text-to-video',
      inputParams: { prompt: 'cat' },
    })
    const task = {
      id: 't1',
      type: 'generate.video',
      domain: 'generate',
      status: 'running',
      input: { recordId: record.id, model: 'wan2.7-t2v', category: 'video', subCategory: 'text-to-video', params: { prompt: 'cat' } },
    } as never

    const out = await handleGenerate(task, makeFakeCtx())
    expect(out.fileCount).toBe(1)

    // record 应被标记 succeeded + files 入库
    const fileRows = await pool.query('SELECT count(*)::int as n FROM generation_files WHERE record_id = $1', [record.id])
    expect(fileRows.rows[0].n).toBe(1)
  })

  it('throws TaskInputError when input missing recordId', async () => {
    const task = { id: 't2', type: 'generate.video', input: { model: 'x' } } as never
    await expect(handleGenerate(task, makeFakeCtx())).rejects.toThrow(/缺少必要输入字段/)
  })

  it('throws TaskInputError for unknown model', async () => {
    const task = {
      id: 't3',
      type: 'generate.video',
      input: { recordId: 'r1', model: 'nope', category: 'video', subCategory: 'x', params: {} },
    } as never
    await expect(handleGenerate(task, makeFakeCtx())).rejects.toThrow(/未知模型/)
  })
})

describe('handleAnalysis', () => {
  it('analysis.asr: runs ASR and stores { text, srt, sentences }', async () => {
    const { createProject } = await import('@seq/db')
    const project = await createProject({ userId, videoUrl: 'http://v.mp4' })
    const task = {
      id: 't4',
      type: 'analysis.asr',
      input: { projectId: project.id, step: 'asr', videoUrl: 'http://v.mp4' },
    } as never
    const out = (await handleAnalysis(task, makeFakeCtx())) as { text: string; sentenceCount: number }
    expect(out.text).toBe('你好世界')
    expect(out.sentenceCount).toBe(1)
    const stepRows = await pool.query('SELECT status, result FROM analysis_steps WHERE project_id = $1 AND step = $2', [project.id, 'asr'])
    expect(stepRows.rows[0].status).toBe('succeeded')
    expect((stepRows.rows[0].result as { text: string }).text).toBe('你好世界')
  })

  it('analysis.script: reads ASR result → video understand + merge → stores script', async () => {
    const { createProject, upsertStep } = await import('@seq/db')
    const project = await createProject({ userId, videoUrl: 'http://v.mp4' })
    // 先填充 ASR 步骤结果（模拟上一步已完成）
    await upsertStep(project.id, 'asr', { status: 'succeeded', result: { text: 'ASR 文本', srt: '1\n00:00:00,000 --> 00:00:01,000\nASR 文本\n' } })
    const task = {
      id: 't5',
      type: 'analysis.script',
      input: { projectId: project.id, step: 'script', videoUrl: 'http://v.mp4' },
    } as never
    const out = (await handleAnalysis(task, makeFakeCtx())) as { script: string; sceneAnalysis: string }
    // 视频理解 mock 返回「场景分析」，合并 mock 返回「最终剧本」
    expect(out.sceneAnalysis).toContain('场景分析')
    expect(out.script).toContain('最终剧本')
    const stepRows = await pool.query('SELECT status, result FROM analysis_steps WHERE project_id = $1 AND step = $2', [project.id, 'script'])
    expect(stepRows.rows[0].status).toBe('succeeded')
  })

  it('analysis.script throws when ASR step not done', async () => {
    const { createProject } = await import('@seq/db')
    const project = await createProject({ userId, videoUrl: 'http://v.mp4' })
    const task = {
      id: 't6',
      type: 'analysis.script',
      input: { projectId: project.id, step: 'script', videoUrl: 'http://v.mp4' },
    } as never
    await expect(handleAnalysis(task, makeFakeCtx())).rejects.toThrow(/ASR.*未完成/)
  })

  it('throws TaskInputError when missing projectId', async () => {
    const task = { id: 't7', type: 'analysis.asr', input: { step: 'asr' } } as never
    await expect(handleAnalysis(task, makeFakeCtx())).rejects.toThrow(/缺少 projectId/)
  })
})
