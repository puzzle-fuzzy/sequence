import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// 缓存到 globalThis 以在热重载中存活
type Db = NodePgDatabase<typeof schema>

interface GlobalWithDb {
  __seqDb?: Db
  __seqPool?: Pool
}

const g = globalThis as unknown as GlobalWithDb

/**
 * 返回单例 DB 连接。env.DATABASE_URL 必填。
 * setDb() 用于测试注入事务 scope 实例。
 */
export function getDb(): Db {
  if (g.__seqDb) return g.__seqDb
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL 未设置')
  const pool = new Pool({ connectionString: url })
  g.__seqPool = pool
  g.__seqDb = drizzle(pool, { schema })
  return g.__seqDb
}

/** 测试注入：用一个事务-bound 或 mock 的实例替换单例。 */
export function setDb(db: Db): void {
  g.__seqDb = db
}

/** 测试后清理：清空单例并关闭池。 */
export function resetDb(): void {
  g.__seqPool?.end().catch(() => {})
  g.__seqDb = undefined
  g.__seqPool = undefined
}

export const db = new Proxy({} as Db, {
  get(_t, prop) {
    return Reflect.get(getDb() as object, prop)
  },
})
