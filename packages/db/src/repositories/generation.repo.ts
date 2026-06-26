import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../client'
import { generationRecords, generationFiles, type NewGenerationRecord, type GenerationRecord, type GenerationFile } from '../schema/generation'

export async function createRecord(input: NewGenerationRecord): Promise<GenerationRecord> {
  const rows = await db.insert(generationRecords).values(input).returning()
  const row = rows[0]
  if (!row) throw new Error('createRecord: insert returned no row')
  return row
}

export async function findRecordById(id: string): Promise<{ record: GenerationRecord; files: GenerationFile[] } | null> {
  const recordRows = await db.select().from(generationRecords).where(eq(generationRecords.id, id)).limit(1)
  const record = recordRows[0]
  if (!record) return null
  const files = await db.select().from(generationFiles).where(eq(generationFiles.recordId, id))
  return { record, files }
}

export async function listRecords(userId: string, limit = 50): Promise<{ items: GenerationRecord[]; total: number }> {
  const items = await db
    .select()
    .from(generationRecords)
    .where(and(eq(generationRecords.userId, userId), isNull(generationRecords.deletedAt)))
    .orderBy(desc(generationRecords.createdAt))
    .limit(limit)
  return { items, total: items.length }
}

export async function updateStatus(id: string, status: GenerationRecord['status'], patch: Partial<GenerationRecord> = {}): Promise<GenerationRecord | null> {
  const updated = await db.update(generationRecords).set({ status, ...patch, updatedAt: new Date() }).where(eq(generationRecords.id, id)).returning()
  return updated[0] ?? null
}

export async function addFile(input: { recordId: string; kind: string; storagePath: string; mimeType?: string; sizeBytes?: number; sourceUrl?: string; originalFilename?: string }): Promise<GenerationFile> {
  const rows = await db.insert(generationFiles).values(input).returning()
  const row = rows[0]
  if (!row) throw new Error('addFile: insert returned no row')
  return row
}

export async function softDelete(id: string): Promise<void> {
  await db.update(generationRecords).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(generationRecords.id, id))
}
