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
  it('upserts step as succeeded (stub)', async () => {
    const { createProject } = await import('@seq/db')
    const project = await createProject({ userId, videoUrl: 'http://v.mp4' })
    const task = {
      id: 't4',
      type: 'analysis.asr',
      input: { projectId: project.id, step: 'asr', videoUrl: 'http://v.mp4' },
    } as never
    const out = await handleAnalysis(task, makeFakeCtx())
    expect(out.step).toBe('asr')
    const stepRows = await pool.query('SELECT status FROM analysis_steps WHERE project_id = $1', [project.id])
    expect(stepRows.rows[0].status).toBe('succeeded')
  })

  it('throws TaskInputError when missing projectId', async () => {
    const task = { id: 't5', type: 'analysis.asr', input: { step: 'asr' } } as never
    await expect(handleAnalysis(task, makeFakeCtx())).rejects.toThrow(/缺少 projectId/)
  })
})
