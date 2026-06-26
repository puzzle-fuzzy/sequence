import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../src/schema'
import { setDb, resetDb } from '../src/client'
import * as usersRepo from '../src/repositories/users.repo'

let pool: Pool

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  setDb(drizzle(pool, { schema }))
})

afterAll(async () => {
  resetDb()
})

beforeEach(async () => {
  await pool.query('TRUNCATE users CASCADE')
})

describe('users.repo', () => {
  it('createUser inserts and returns the row', async () => {
    const user = await usersRepo.createUser({
      username: 'alice',
      email: 'alice@example.com',
      password: 'hashed',
    })
    expect(user.id).toBeDefined()
    expect(user.username).toBe('alice')
    expect(user.role).toBe('user')
  })

  it('findUserById returns the user', async () => {
    const created = await usersRepo.createUser({ username: 'bob', email: 'bob@example.com', password: 'h' })
    const found = await usersRepo.findUserById(created.id)
    expect(found?.username).toBe('bob')
  })

  it('findUserByEmail returns the user', async () => {
    await usersRepo.createUser({ username: 'carol', email: 'carol@example.com', password: 'h' })
    const found = await usersRepo.findUserByEmail('carol@example.com')
    expect(found?.username).toBe('carol')
  })

  it('findUserByEmail returns null when not found', async () => {
    expect(await usersRepo.findUserByEmail('nope@example.com')).toBeNull()
  })

  it('touchLastLogin updates lastLoginAt', async () => {
    const u = await usersRepo.createUser({ username: 'dave', email: 'dave@example.com', password: 'h' })
    await usersRepo.touchLastLogin(u.id)
    const found = await usersRepo.findUserById(u.id)
    expect(found?.lastLoginAt).toBeInstanceOf(Date)
  })
})
