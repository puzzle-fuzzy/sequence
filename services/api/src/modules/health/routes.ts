import { Elysia } from 'elysia'
import { db } from '@seq/db'
import { sql } from 'drizzle-orm'

/** health 路由 — /live、/ready、/db。 */
export function createHealthRoutes() {
  return new Elysia({ prefix: '/api/health' })
    .get('/live', () => ({ ok: true }), { detail: { summary: 'Liveness probe' } })
    .get('/ready', async () => {
      try {
        await db.execute(sql`SELECT 1`)
        return { ok: true, db: 'up' }
      } catch {
        return { ok: false, db: 'down' }
      }
    })
    .get('/db', async () => {
      const result = await db.execute(sql`SELECT NOW() as now`)
      return { ok: true, now: (result.rows[0] as { now: unknown })?.now ?? null }
    })
}
