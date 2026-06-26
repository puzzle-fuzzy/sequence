import {
  integer, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { type GenerationInputParams } from '@seq/shared'

export const recordStatus = pgEnum('record_status', [
  'submitting', 'processing', 'saving_output', 'succeeded', 'failed', 'cancelled',
])

export const generationRecords = pgTable(
  'generation_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    model: varchar('model', { length: 60 }).notNull(),
    category: varchar('category', { length: 20 }).notNull(),
    subCategory: varchar('sub_category', { length: 40 }).notNull(),
    inputParams: jsonb('input_params').$type<GenerationInputParams>().notNull(),
    outputResult: jsonb('output_result').$type<Record<string, unknown> | null>(),
    status: recordStatus('status').notNull().default('submitting'),
    cost: jsonb('cost').$type<Record<string, unknown> | null>(),
    dedupeKey: varchar('dedupe_key', { length: 255 }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: uniqueIndex('gen_records_user_created_idx').on(t.userId, t.createdAt),
    dedupeIdx: uniqueIndex('gen_records_dedupe_idx').on(t.dedupeKey),
  }),
)

export const generationFiles = pgTable('generation_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  recordId: uuid('record_id').notNull().references(() => generationRecords.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 30 }).notNull(),
  sourceUrl: varchar('source_url', { length: 1024 }),
  storagePath: varchar('storage_path', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  sizeBytes: integer('size_bytes'),
  originalFilename: varchar('original_filename', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export type GenerationRecord = typeof generationRecords.$inferSelect
export type NewGenerationRecord = typeof generationRecords.$inferInsert
export type GenerationFile = typeof generationFiles.$inferSelect
