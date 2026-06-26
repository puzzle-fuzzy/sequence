import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../src/schema'
import { setDb, resetDb } from '../src/client'
import * as usersRepo from '../src/repositories/users.repo'
import * as genRepo from '../src/repositories/generation.repo'

let pool: Pool
let userId: string

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  setDb(drizzle(pool, { schema }))
  await pool.query("DELETE FROM users WHERE username = 'gen'")
  const u = await usersRepo.createUser({ username: 'gen', email: 'gen@example.com', password: 'h' })
  userId = u.id
})
afterAll(() => resetDb())
beforeEach(async () => {
  await pool.query('TRUNCATE generation_files, generation_records RESTART IDENTITY CASCADE')
})

describe('generation.repo', () => {
  it('createRecord inserts submitting record', async () => {
    const r = await genRepo.createRecord({ userId, model: 'wan2.7-t2v', category: 'video', subCategory: 'text-to-video', inputParams: { prompt: 'cat' } })
    expect(r.status).toBe('submitting')
    expect(r.inputParams).toEqual({ prompt: 'cat' })
  })

  it('findRecordById returns record + files', async () => {
    const r = await genRepo.createRecord({ userId, model: 'm', category: 'video', subCategory: 't2v', inputParams: {} })
    await genRepo.addFile({ recordId: r.id, kind: 'primary', storagePath: '/x.mp4', mimeType: 'video/mp4', sizeBytes: 10 })
    const found = await genRepo.findRecordById(r.id)
    expect(found?.record.id).toBe(r.id)
    expect(found?.files).toHaveLength(1)
  })

  it('listRecords returns user records newest-first', async () => {
    await genRepo.createRecord({ userId, model: 'm', category: 'video', subCategory: 't2v', inputParams: {} })
    await genRepo.createRecord({ userId, model: 'm', category: 'video', subCategory: 't2v', inputParams: {} })
    const { items, total } = await genRepo.listRecords(userId, 50)
    expect(total).toBe(2)
    expect(items[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(items[1]!.createdAt.getTime())
  })

  it('softDelete sets deletedAt', async () => {
    const r = await genRepo.createRecord({ userId, model: 'm', category: 'video', subCategory: 't2v', inputParams: {} })
    await genRepo.softDelete(r.id)
    const { items } = await genRepo.listRecords(userId, 50)
    expect(items.find((i) => i.id === r.id)).toBeUndefined()
  })
})
