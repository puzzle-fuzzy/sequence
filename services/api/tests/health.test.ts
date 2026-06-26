import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@seq/db'
import { setDb, resetDb } from '@seq/db'
import { handleError } from '../src/lib/app-errors'
import { createHealthRoutes } from '../src/modules/health/routes'
import { treatyFor } from './helpers/test-factory'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app: any = new Elysia().onError(handleError).use(createHealthRoutes())
const api = treatyFor(app)

let pool: Pool
beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  setDb(drizzle(pool, { schema: schema.schema }))
})
afterAll(() => resetDb())

describe('health routes', () => {
  it('/live returns ok', async () => {
    const res = await api.api.health.live.get()
    expect(res.status).toBe(200)
    expect(res.data?.ok).toBe(true)
  })

  it('/ready reports db up', async () => {
    const res = await api.api.health.ready.get()
    expect(res.status).toBe(200)
    expect(res.data?.db).toBe('up')
  })

  it('/db returns a timestamp', async () => {
    const res = await api.api.health.db.get()
    expect(res.status).toBe(200)
    expect(res.data?.ok).toBe(true)
    expect(res.data?.now).toBeTruthy()
  })
})
