import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL 未设置')

const pool = new Pool({ connectionString: url })
const db = drizzle(pool, { schema })

await migrate(db, { migrationsFolder: './drizzle' })
console.log('[db] migrations applied')
await pool.end()
