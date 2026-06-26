import { eq, and, isNull, desc } from 'drizzle-orm'
import { db, transferSessions, type TransferSession } from '@seq/db'
import { serialize } from '@seq/shared'
import { NotFoundError, ForbiddenError } from '../../lib/app-errors'

function toSessionResponse(s: TransferSession) {
  return serialize({ ...s })
}

export async function createSession(userId: string) {
  const rows = await db.insert(transferSessions).values({ userId }).returning()
  const row = rows[0]
  if (!row) throw new Error('createSession: insert returned no row')
  return { session: toSessionResponse(row) }
}

export async function listUserSessions(userId: string) {
  const items = await db
    .select()
    .from(transferSessions)
    .where(and(eq(transferSessions.userId, userId), eq(transferSessions.status, 'active')))
    .orderBy(desc(transferSessions.createdAt))
    .limit(50)
  return { items: items.map(toSessionResponse), total: items.length }
}

export async function getSession(userId: string, sessionId: string) {
  const rows = await db.select().from(transferSessions).where(eq(transferSessions.id, sessionId)).limit(1)
  const row = rows[0]
  if (!row) throw new NotFoundError('会话不存在')
  if (row.userId !== userId) throw new ForbiddenError('无权访问该会话')
  return { session: toSessionResponse(row) }
}
