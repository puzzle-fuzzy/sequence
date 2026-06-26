import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@seq/db'
import { setDb, resetDb } from '@seq/db'
import { handleError } from '../src/lib/app-errors'
import { createAuthRoutes } from '../src/modules/auth/routes'
import { makeAccount, treatyFor } from './helpers/test-factory'

// 组装最小测试 app：onError（内联注册）+ auth routes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app: any = new Elysia().onError(handleError).use(createAuthRoutes('test-secret'))
const api = treatyFor(app)

let pool: Pool

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  setDb(drizzle(pool, { schema: schema.schema }))
})
afterAll(() => resetDb())
beforeEach(async () => {
  await pool.query('TRUNCATE users CASCADE')
})

/** 从 set-cookie 头提取 auth cookie 值（auth=...）。 */
function extractAuthCookie(headers: Record<string, string | string[] | undefined> | undefined): string | null {
  if (!headers) return null
  // headers 可能被序列化为各种形态，统一转字符串后正则提取首个 auth= 值
  const blob = JSON.stringify(headers)
  const m = /auth=([^;"]+)/.exec(blob)
  return m ? `auth=${m[1]}` : null
}

describe('auth routes', () => {
  it('register creates a user and sets cookie', async () => {
    const res = await api.api.auth.register.post({ username: 'newbie', email: 'new@test.com', password: 'secret123' })
    expect(res.status).toBe(200)
    expect(res.error).toBeNull()
    expect(res.data?.user.username).toBe('newbie')
    expect(res.data?.user.role).toBe('user')
    expect(extractAuthCookie(res.headers)).not.toBeNull()
  })

  it('register duplicate username → 409', async () => {
    await makeAccount({ username: 'dup', email: 'd1@test.com' })
    const res = await api.api.auth.register.post({ username: 'dup', email: 'd2@test.com', password: 'x' })
    expect(res.status).toBe(409)
    expect(res.error).not.toBeNull()
  })

  it('login with correct password returns user + cookie', async () => {
    await makeAccount({ username: 'loginer', email: 'l@test.com', password: 'pass123' })
    const res = await api.api.auth.login.post({ email: 'l@test.com', password: 'pass123' })
    expect(res.status).toBe(200)
    expect(res.data?.user.username).toBe('loginer')
    expect(extractAuthCookie(res.headers)).not.toBeNull()
  })

  it('login with wrong password → 401', async () => {
    await makeAccount({ username: 'wp', email: 'wp@test.com', password: 'correct' })
    const res = await api.api.auth.login.post({ email: 'wp@test.com', password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.error).not.toBeNull()
  })

  it('me without auth → 401', async () => {
    const res = await api.api.auth.me.get()
    expect(res.status).toBe(401)
    expect(res.error).not.toBeNull()
  })

  it('me with auth cookie returns the user', async () => {
    await makeAccount({ username: 'meuser', email: 'me@test.com', password: 'pw123' })
    const login = await api.api.auth.login.post({ email: 'me@test.com', password: 'pw123' })
    const authCookie = extractAuthCookie(login.headers)!

    const meRes = await api.api.auth.me.get({ headers: { cookie: authCookie } })
    expect(meRes.status).toBe(200)
    expect(meRes.data?.username).toBe('meuser')
  })

  it('logout clears cookie', async () => {
    const res = await api.api.auth.logout.post()
    expect(res.status).toBe(200)
    expect(res.data?.ok).toBe(true)
  })
})
