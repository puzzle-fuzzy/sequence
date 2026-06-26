import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../client'
import { analysisProjects, analysisSteps, type NewAnalysisProject, type AnalysisProject, type AnalysisStep } from '../schema/analysis'

export async function createProject(input: NewAnalysisProject): Promise<AnalysisProject> {
  const rows = await db.insert(analysisProjects).values(input).returning()
  const row = rows[0]
  if (!row) throw new Error('createProject: insert returned no row')
  return row
}

export async function findProjectById(id: string): Promise<AnalysisProject | null> {
  const rows = await db.select().from(analysisProjects).where(eq(analysisProjects.id, id)).limit(1)
  return rows[0] ?? null
}

export async function listProjects(userId: string, limit = 50): Promise<{ items: AnalysisProject[]; total: number }> {
  const items = await db
    .select()
    .from(analysisProjects)
    .where(and(eq(analysisProjects.userId, userId), isNull(analysisProjects.deletedAt)))
    .orderBy(asc(analysisProjects.createdAt))
    .limit(limit)
  return { items, total: items.length }
}

export async function findStepsByProject(projectId: string): Promise<AnalysisStep[]> {
  return db.select().from(analysisSteps).where(eq(analysisSteps.projectId, projectId)).orderBy(asc(analysisSteps.createdAt))
}

export async function upsertStep(projectId: string, step: AnalysisStep['step'], patch: Partial<AnalysisStep>): Promise<AnalysisStep> {
  const existingRows = await db
    .select()
    .from(analysisSteps)
    .where(and(eq(analysisSteps.projectId, projectId), eq(analysisSteps.step, step)))
    .limit(1)
  const existing = existingRows[0]
  if (existing) {
    const updated = await db.update(analysisSteps).set({ ...patch, updatedAt: new Date() }).where(eq(analysisSteps.id, existing.id)).returning()
    const row = updated[0]
    if (!row) throw new Error('upsertStep: update returned no row')
    return row
  }
  const created = await db.insert(analysisSteps).values({ projectId, step, ...patch }).returning()
  const row = created[0]
  if (!row) throw new Error('upsertStep: insert returned no row')
  return row
}
