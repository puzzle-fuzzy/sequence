import { and, desc, eq, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { tasks, type NewTask, type Task } from '../schema/tasks'
import { TASK_STATUS, type TaskErrorInfo } from '@seq/shared'

export async function createTask(input: NewTask): Promise<Task> {
  const rows = await db.insert(tasks).values(input).returning()
  const row = rows[0]
  if (!row) throw new Error('createTask: insert returned no row')
  return row
}

export async function findTaskById(id: string): Promise<Task | null> {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
  return rows[0] ?? null
}

/**
 * 领取下一个可执行任务 — FOR UPDATE SKIP LOCKED。
 * 筛选 queued（或 retrying 到期），按 priority 升序、createdAt 升序，加行锁，
 * 置 running + lockedBy + lockedUntil。返回 null 表示无 eligible。
 */
export async function claimNextTask(workerId: string, claimTtlMs: number): Promise<Task | null> {
  const eligible = and(
    or(
      eq(tasks.status, TASK_STATUS.QUEUED),
      and(eq(tasks.status, TASK_STATUS.RETRYING), lte(tasks.nextRunAt, new Date())),
    ),
    isNull(tasks.lockedBy),
  )
  const claimedRows = await db
    .select()
    .from(tasks)
    .where(eligible)
    .orderBy(tasks.priority, tasks.createdAt)
    .limit(1)
    .for('update', { skipLocked: true })

  const claimed = claimedRows[0]
  if (!claimed) return null

  const lockedUntil = new Date(Date.now() + claimTtlMs)
  const updated = await db
    .update(tasks)
    .set({ status: TASK_STATUS.RUNNING, lockedBy: workerId, lockedUntil, updatedAt: new Date() })
    .where(and(eq(tasks.id, claimed.id), isNull(tasks.lockedBy)))
    .returning()
  return updated[0] ?? claimed
}

/** heartbeat：续锁。返回 null 表示锁已丢（被 sweep/cancel）。 */
export async function extendTaskLock(id: string, workerId: string, claimTtlMs: number): Promise<Task | null> {
  const lockedUntil = new Date(Date.now() + claimTtlMs)
  const updated = await db
    .update(tasks)
    .set({ lockedUntil, updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.lockedBy, workerId)))
    .returning()
  return updated[0] ?? null
}

/** 清扫锁过期 > timeoutMinutes 的 running 任务，重置为 queued。返回清扫数。 */
export async function sweepOrphanTasks(timeoutMinutes = 5): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000)
  const result = await db
    .update(tasks)
    .set({ status: TASK_STATUS.QUEUED, lockedBy: null, lockedUntil: null, updatedAt: new Date() })
    .where(and(eq(tasks.status, TASK_STATUS.RUNNING), lt(tasks.lockedUntil, cutoff)))
    .returning({ id: tasks.id })
  return result.length
}

export async function markSucceeded(id: string, output: Record<string, unknown>): Promise<Task | null> {
  const updated = await db
    .update(tasks)
    .set({ status: TASK_STATUS.SUCCEEDED, output, lockedBy: null, lockedUntil: null, errorJson: null, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning()
  return updated[0] ?? null
}

export async function markRetrying(id: string, nextRunAt: Date): Promise<Task | null> {
  const updated = await db
    .update(tasks)
    .set({ status: TASK_STATUS.RETRYING, nextRunAt, lockedBy: null, lockedUntil: null, attempts: sql`${tasks.attempts} + 1`, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning()
  return updated[0] ?? null
}

export async function markFailed(id: string, errorJson: Record<string, unknown>, errorMessage: string): Promise<Task | null> {
  const info: TaskErrorInfo = {
    category: (errorJson.category as TaskErrorInfo['category']) ?? 'system',
    retriable: (errorJson.retriable as boolean | undefined) ?? false,
    ...(errorJson.code !== undefined ? { code: String(errorJson.code) } : {}),
    message: errorMessage,
  }
  const updated = await db
    .update(tasks)
    .set({ status: TASK_STATUS.FAILED, errorJson: info, lockedBy: null, lockedUntil: null, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning()
  return updated[0] ?? null
}

export async function cancelTask(id: string): Promise<Task | null> {
  const updated = await db
    .update(tasks)
    .set({ status: TASK_STATUS.CANCELLED, lockedBy: null, lockedUntil: null, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning()
  return updated[0] ?? null
}

/** 测试辅助：直接置为运行中 + 指定锁状态（模拟孤儿）。 */
export async function markRunningForTest(id: string, workerId: string, lockedUntil: Date): Promise<void> {
  await db.update(tasks).set({ status: TASK_STATUS.RUNNING, lockedBy: workerId, lockedUntil }).where(eq(tasks.id, id))
}

/** 列出某 record 关联的任务（按创建序）。 */
export async function findTasksByRecord(recordId: string): Promise<Task[]> {
  return db.select().from(tasks).where(eq(tasks.recordId, recordId)).orderBy(desc(tasks.createdAt))
}
