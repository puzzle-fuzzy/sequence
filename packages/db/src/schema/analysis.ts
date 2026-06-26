import { jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import { tasks } from './tasks'

export const analysisStepName = pgEnum('analysis_step', ['asr', 'script'])

export const analysisProjects = pgTable('analysis_projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoUrl: varchar('video_url', { length: 1024 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  currentStep: analysisStepName('current_step'),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export const analysisSteps = pgTable('analysis_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => analysisProjects.id, { onDelete: 'cascade' }),
  step: analysisStepName('step').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | running | succeeded | failed
  result: jsonb('result').$type<Record<string, unknown> | null>(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export type AnalysisProject = typeof analysisProjects.$inferSelect
export type NewAnalysisProject = typeof analysisProjects.$inferInsert
export type AnalysisStep = typeof analysisSteps.$inferSelect
