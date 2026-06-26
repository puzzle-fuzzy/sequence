import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../src/schema'
import { setDb, resetDb } from '../src/client'
import * as usersRepo from '../src/repositories/users.repo'
import * as tasksRepo from '../src/repositories/tasks.repo'
import { TASK_DOMAIN, TASK_STATUS } from '@seq/shared'

let pool: Pool
let userId: string

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  setDb(drizzle(pool, { schema }))
  const u = await usersRepo.createUser({ username: 'tasker', email: 'tasker@example.com', password: 'h' })
  userId = u.id
})

afterAll(() => resetDb())

beforeEach(async () => {
  await pool.query('TRUNCATE tasks RESTART IDENTITY CASCADE')
})

describe('tasks.repo', () => {
  it('createTask inserts a queued task', async () => {
    const t = await tasksRepo.createTask({ userId, type: 'generate.video', domain: TASK_DOMAIN.GENERATE, input: { model: 'x' } })
    expect(t.status).toBe(TASK_STATUS.QUEUED)
    expect(t.attempts).toBe(0)
  })

  it('claimNextTask locks and returns the highest-priority eligible task, or null', async () => {
    await tasksRepo.createTask({ userId, type: 'a', domain: TASK_DOMAIN.GENERATE, input: {}, priority: 5 })
    await tasksRepo.createTask({ userId, type: 'b', domain: TASK_DOMAIN.GENERATE, input: {}, priority: 3 })
    const claimed = await tasksRepo.claimNextTask('worker-1', 60_000)
    expect(claimed).not.toBeNull()
    expect(claimed!.type).toBe('b') // priority 3 < 5 → claimed first
    expect(claimed!.lockedBy).toBe('worker-1')
    expect(claimed!.status).toBe(TASK_STATUS.RUNNING)
  })

  it('claimNextTask returns null when nothing eligible', async () => {
    expect(await tasksRepo.claimNextTask('worker-1', 60_000)).toBeNull()
  })

  it('claimNextTask skips running/locked tasks', async () => {
    await tasksRepo.createTask({ userId, type: 'a', domain: TASK_DOMAIN.GENERATE, input: {}, priority: 5 })
    await tasksRepo.claimNextTask('worker-1', 60_000) // locks it
    expect(await tasksRepo.claimNextTask('worker-2', 60_000)).toBeNull()
  })

  it('extendTaskLock pushes lockedUntil forward', async () => {
    const t = await tasksRepo.createTask({ userId, type: 'a', domain: TASK_DOMAIN.GENERATE, input: {} })
    await tasksRepo.claimNextTask('worker-1', 60_000)
    const extended = await tasksRepo.extendTaskLock(t.id, 'worker-1', 120_000)
    expect(extended?.lockedBy).toBe('worker-1')
  })

  it('sweepOrphanTasks resets tasks whose lock expired', async () => {
    const t = await tasksRepo.createTask({ userId, type: 'a', domain: TASK_DOMAIN.GENERATE, input: {} })
    // 直接置为运行中 + 过期锁
    await tasksRepo.markRunningForTest(t.id, 'dead-worker', new Date(Date.now() - 10 * 60 * 1000))
    const swept = await tasksRepo.sweepOrphanTasks(5)
    expect(swept).toBeGreaterThanOrEqual(1)
    const after = await tasksRepo.findTaskById(t.id)
    expect(after?.status).toBe(TASK_STATUS.QUEUED)
    expect(after?.lockedBy).toBeNull()
  })

  it('markSucceeded updates status + output', async () => {
    const t = await tasksRepo.createTask({ userId, type: 'a', domain: TASK_DOMAIN.GENERATE, input: {} })
    const updated = await tasksRepo.markSucceeded(t.id, { video_url: 'http://x' })
    expect(updated?.status).toBe(TASK_STATUS.SUCCEEDED)
    expect(updated?.output).toEqual({ video_url: 'http://x' })
  })
})
