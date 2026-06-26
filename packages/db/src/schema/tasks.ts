import {
  index, integer, jsonb, pgEnum, pgTable, timestamp, uuid, varchar,
} from 'drizzle-orm/pg-core'
import { TASK_STATUS, TASK_DOMAIN, type TaskErrorInfo } from '@seq/shared'

export const taskStatus = pgEnum('task_status', [
  TASK_STATUS.QUEUED, TASK_STATUS.RUNNING, TASK_STATUS.RETRYING,
  TASK_STATUS.SUCCEEDED, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED,
])

export const taskDomain = pgEnum('task_domain', [
  TASK_DOMAIN.GENERATE, TASK_DOMAIN.ANALYSIS, TASK_DOMAIN.TRANSFER,
])

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: varchar('type', { length: 60 }).notNull(),
    domain: taskDomain('domain').notNull(),
    status: taskStatus('status').notNull().default(TASK_STATUS.QUEUED),
    priority: integer('priority').notNull().default(5),
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    output: jsonb('output').$type<Record<string, unknown> | null>(),
    // claim 锁
    lockedBy: varchar('locked_by', { length: 60 }),
    lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'date' }),
    // 重试
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    nextRunAt: timestamp('next_run_at', { withTimezone: true, mode: 'date' }),
    // 错误
    errorJson: jsonb('error_json').$type<TaskErrorInfo | null>(),
    // 关联
    recordId: uuid('record_id'),
    projectId: uuid('project_id'),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({
    statusDomainIdx: index('tasks_status_domain_idx').on(t.status, t.domain),
    nextRunIdx: index('tasks_next_run_idx').on(t.nextRunAt),
    recordIdx: index('tasks_record_idx').on(t.recordId),
    projectIdx: index('tasks_project_idx').on(t.projectId),
  }),
)

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
