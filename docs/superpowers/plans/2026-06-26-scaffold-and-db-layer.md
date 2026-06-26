# Scaffold + DB Layer Implementation Plan (Phase 1-2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Bun workspace monorepo scaffolding and deliver a fully-typed PostgreSQL data layer (`@seq/shared` + `@seq/db`) with all eight tables from the spec, typed JSONB columns, repositories, and a test harness that runs against a real Postgres in a transaction scope.

**Architecture:** Bun workspace + Turborepo. Packages consumed as TypeScript source via `workspace:*`. `@seq/shared` is the BASE layer (logger, config, serialize, cross-domain types). `@seq/db` holds Drizzle ORM schema + async repository functions + a `getDb()/setDb()` singleton for test injection. Type derivation is one-way: Drizzle schema → `InferSelectModel` → `serialize()` → API types. JSONB columns carry domain types via `$type<T>()`.

**Tech Stack:** Bun (runtime/pm/test), TypeScript 5.6+ (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), Turborepo 2, Drizzle ORM + drizzle-kit, PostgreSQL 17 (docker), `pg` driver.

**Reference spec:** `docs/superpowers/specs/2026-06-26-sequence-v2-architecture-design.md` (§1 packages, §2 DB schema).

**Scope of THIS plan:** Phase 1 (scaffolding) + Phase 2 (shared + db). Subsequent plans cover bailian-core/client, task-engine, storage, services/api, services/worker, and frontend.

---

## File Structure

### Root config (created in Task 1)
- `package.json` — workspace config + catalog (elysia version lock) + turbo scripts
- `turbo.json` — task pipeline (build/dev/lint/typecheck/test)
- `tsconfig.base.json` — shared strict TS config
- `bunfig.toml` — hoisted linker
- `compose.yaml` — postgres:17 service
- `.env.example` — all env vars documented
- `.gitignore` — node_modules, .env, dist, storage, drizzle artifacts

### `@seq/shared` (Task 2)
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts` — barrel
- `packages/shared/src/logger.ts` — `createLogger(name)` (console-based, leveled)
- `packages/shared/src/serialize.ts` — `serialize<T>()` (recursive Date→ISO)
- `packages/shared/src/config.ts` — `loadConfig(env)` typed config object
- `packages/shared/src/domain-types.ts` — pure interfaces (TaskStatus, TaskErrorInfo, ProviderResult union, GenerationInputParams)
- `packages/shared/tests/serialize.test.ts`

### `@seq/db` (Tasks 3-7)
- `packages/db/package.json`
- `packages/db/tsconfig.json`
- `packages/db/drizzle.config.ts`
- `packages/db/src/index.ts` — barrel (`db`, `table`, `getDb`, `setDb`, `serialize`)
- `packages/db/src/client.ts` — `getDb()/setDb()` pool singleton
- `packages/db/src/types.ts` — re-export `serialize` from shared (shim for db-local imports)
- `packages/db/src/schema/index.ts` — barrel
- `packages/db/src/schema/users.ts` — `users` table + `userRole` enum
- `packages/db/src/schema/tasks.ts` — `tasks` table + `taskStatus`, `taskDomain` enums
- `packages/db/src/schema/generation.ts` — `generationRecords` + `generationFiles`
- `packages/db/src/schema/analysis.ts` — `analysisProjects` + `analysisSteps` + `analysisStep` enum
- `packages/db/src/schema/transfer.ts` — `transferSessions`
- `packages/db/src/schema/uploads.ts` — `uploadedFiles`
- `packages/db/src/repositories/users.repo.ts`
- `packages/db/src/repositories/tasks.repo.ts` — claim/lock/sweep (FOR UPDATE SKIP LOCKED)
- `packages/db/src/repositories/generation.repo.ts`
- `packages/db/src/repositories/analysis.repo.ts`
- `packages/db/src/migrate.ts` — `bun --env-file` migrate entrypoint
- `packages/db/tests/users.repo.test.ts`
- `packages/db/tests/tasks.repo.test.ts`
- `packages/db/tests/generation.repo.test.ts`

---

## Task 1: Monorepo scaffolding

**Files:**
- Create: `package.json`, `turbo.json`, `tsconfig.base.json`, `bunfig.toml`, `compose.yaml`, `.env.example`, `.gitignore`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "sequence",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "packageManager": "bun@1.3.14",
  "workspaces": {
    "packages": ["apps/*", "packages/*", "services/*"],
    "catalog": {
      "elysia": "^1.4.29"
    }
  },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:push": "bun run --cwd packages/db db:push",
    "db:migrate": "bun run --cwd packages/db db:migrate",
    "db:studio": "bun run --cwd packages/db db:studio",
    "db:test": "bun run --cwd packages/db test"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "turbo": "^2.10.0",
    "typescript": "^5.6.0"
  },
  "engines": {
    "bun": ">=1.1.0"
  }
}
```

- [ ] **Step 2: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "typecheck": {},
    "test": {},
    "preview": { "cache": false, "persistent": true }
  }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 4: Create `bunfig.toml`**

```toml
[install]
linker = "hoisted"
```

- [ ] **Step 5: Create `compose.yaml`**

```yaml
services:
  db:
    image: postgres:17-alpine
    container_name: sequence-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: sequence
      POSTGRES_PASSWORD: sequence_dev
      POSTGRES_DB: sequence
    ports:
      - "5432:5432"
    volumes:
      - sequence_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sequence -d sequence"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  sequence_pgdata:
```

- [ ] **Step 6: Create `.env.example`**

```bash
# PostgreSQL (matches compose.yaml)
DATABASE_URL=postgres://sequence:sequence_dev@localhost:5432/sequence

# Auth
JWT_SECRET=dev-secret-change-me

# Bailian (Aliyun Model Studio)
BAILIAN_API_KEY=replace-with-real-key
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1

# Storage
STORAGE_DIR=./storage
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=
OSS_UPLOAD_PREFIX=sequence

# Worker
WORKER_POLL_INTERVAL_MS=5000
WORKER_CLAIM_TTL_MS=60000
WORKER_SWEEP_INTERVAL_MS=300000
WORKER_HEALTH_PORT=3001

# API
PORT=3000
CORS_ORIGIN=http://localhost:5174
NODE_ENV=development
```

- [ ] **Step 7: Create `.gitignore`**

```gitignore
node_modules/
.env
dist/
storage/
.turbo/
*.tsbuildinfo
coverage/
drizzle/generated/
```

- [ ] **Step 8: Start Postgres and verify**

Run: `docker compose up -d db`
Expected: container `sequence-db` running, `docker compose ps` shows healthy within ~10s.

- [ ] **Step 9: Install deps and verify workspace resolves**

Run: `bun install`
Expected: `bun.lock` created, no workspace errors (packages don't exist yet, that's fine — they get added in later tasks).

- [ ] **Step 10: Commit**

```bash
git init && git add -A
git commit -m "chore: scaffold bun workspace monorepo"
```

---

## Task 2: `@seq/shared` package (logger, serialize, config, domain types)

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`, `logger.ts`, `serialize.ts`, `config.ts`, `domain-types.ts`
- Test: `packages/shared/tests/serialize.test.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@seq/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {},
  "devDependencies": { "typescript": "^5.6.0" }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "include": ["src", "tests"] }
}
```

- [ ] **Step 3: Create `packages/shared/src/domain-types.ts`**

Pure interfaces (no runtime deps) — the BASE-layer domain vocabulary shared across packages.

```ts
// ---------------------------------------------------------------------------
// 跨领域类型 — BASE 层，无运行时依赖
// ---------------------------------------------------------------------------

/** 统一任务状态（tasks 表 status 枚举的 TS 镜像） */
export const TASK_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  RETRYING: 'retrying',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS]

/** 任务域 */
export const TASK_DOMAIN = {
  GENERATE: 'generate',
  ANALYSIS: 'analysis',
  TRANSFER: 'transfer',
} as const

export type TaskDomain = (typeof TASK_DOMAIN)[keyof typeof TASK_DOMAIN]

/** 任务错误分类 */
export type TaskErrorCategory = 'provider_error' | 'timeout' | 'validation' | 'system'

/** 任务错误信息（存入 tasks.errorJson） */
export interface TaskErrorInfo {
  category: TaskErrorCategory
  retriable: boolean
  code?: string
  message: string
}

// ---------------------------------------------------------------------------
// Provider 调用结果 — 判别联合，消除 v1 的 'choices' in output 字符串判分支
// ---------------------------------------------------------------------------

export interface TextProviderOutput { type: 'text'; text: string; raw: unknown }
export interface ImageProviderOutput { type: 'image'; urls: string[]; raw: unknown }
export interface VideoTaskProviderOutput { type: 'video_task'; taskId: string; status: 'submitted'; raw: unknown }
export interface AudioProviderOutput { type: 'audio'; url: string; durationSeconds: number; format: string; raw: unknown }

export interface TextProviderResult { type: 'text'; success: true; model: string; output: TextProviderOutput }
export interface ImageProviderResult { type: 'image'; success: true; model: string; output: ImageProviderOutput }
export interface VideoTaskProviderResult { type: 'video_task'; success: true; model: string; taskId: string; output: VideoTaskProviderOutput }
export interface AudioProviderResult { type: 'audio'; success: true; model: string; output: AudioProviderOutput }
export interface FailedProviderResult { type: 'failed'; success: false; model?: string; error: string; code?: string }

export type ProviderResult =
  | TextProviderResult
  | ImageProviderResult
  | VideoTaskProviderResult
  | AudioProviderResult
  | FailedProviderResult

// ---------------------------------------------------------------------------
// 生成输入参数 — 附着到 generation_records.inputParams JSONB
// ---------------------------------------------------------------------------

/** 生成任务的输入参数（key = ModelConfig.parameters[].name，value = 用户填写值） */
export type GenerationInputParams = Record<string, unknown>
```

- [ ] **Step 4: Create `packages/shared/src/serialize.ts`**

```ts
/**
 * 递归把 Date 转 ISO 字符串，用于 DB 行 → API 响应的序列化。
 * 取代路由层各自手写的 serializeXxx。
 */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString() as unknown as T
  if (Array.isArray(value)) return value.map(serialize) as unknown as T
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v)
    }
    return out as unknown as T
  }
  return value
}
```

- [ ] **Step 5: Create `packages/shared/src/logger.ts`**

```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export interface Logger {
  debug: (msg: unknown, ...args: unknown[]) => void
  info: (msg: unknown, ...args: unknown[]) => void
  warn: (msg: unknown, ...args: unknown[]) => void
  error: (msg: unknown, ...args: unknown[]) => void
}

/** 创建带 scope 的 leveled logger。env LOG_LEVEL 控制阈值。 */
export function createLogger(scope: string, minLevel: LogLevel = 'info'): Logger {
  const threshold = (process.env.LOG_LEVEL as LogLevel | undefined) ?? minLevel
  const min = ORDER[threshold] ?? ORDER.info

  const make = (level: LogLevel) => (msg: unknown, ...args: unknown[]) => {
    if (ORDER[level] < min) return
    const payload = typeof msg === 'string' ? msg : { err: msg }
    console[level === 'debug' ? 'log' : level](`[${scope}]`, payload, ...args)
  }

  return { debug: make('debug'), info: make('info'), warn: make('warn'), error: make('error') }
}
```

- [ ] **Step 6: Create `packages/shared/src/config.ts`**

```ts
import { TASK_DOMAIN, type TaskDomain } from './domain-types'

export interface AppConfig {
  databaseUrl: string
  jwtSecret: string
  bailianApiKey: string
  bailianBaseUrl: string
  storageDir: string
  oss?: {
    region: string
    accessKeyId: string
    accessKeySecret: string
    bucket: string
    uploadPrefix: string
  }
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key]
  if (!v) throw new Error(`缺少必需环境变量: ${key}`)
  return v
}

/** 从 env 解析强类型配置。OSS 字段缺一即视为未配置 OSS。 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const ossKeys = ['OSS_REGION', 'OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET'] as const
  const ossConfigured = ossKeys.every((k) => env[k])
  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtSecret: required(env, 'JWT_SECRET'),
    bailianApiKey: required(env, 'BAILIAN_API_KEY'),
    bailianBaseUrl: env.BAILIAN_BASE_URL ?? 'https://dashscope.aliyuncs.com/api/v1',
    storageDir: env.STORAGE_DIR ?? './storage',
    ...(ossConfigured
      ? {
          oss: {
            region: env.OSS_REGION!,
            accessKeyId: env.OSS_ACCESS_KEY_ID!,
            accessKeySecret: env.OSS_ACCESS_KEY_SECRET!,
            bucket: env.OSS_BUCKET!,
            uploadPrefix: env.OSS_UPLOAD_PREFIX ?? 'sequence',
          },
        }
      : {}),
  }
}

/** 校验 task domain 字符串是否合法。 */
export function isValidTaskDomain(s: string): s is TaskDomain {
  return Object.values(TASK_DOMAIN).includes(s as TaskDomain)
}
```

- [ ] **Step 7: Create `packages/shared/src/index.ts`**

```ts
export { createLogger, type Logger } from './logger'
export { serialize } from './serialize'
export { loadConfig, isValidTaskDomain, type AppConfig } from './config'
export {
  TASK_STATUS, TASK_DOMAIN,
  type TaskStatus, type TaskDomain, type TaskErrorCategory, type TaskErrorInfo,
  type ProviderResult, type TextProviderResult, type ImageProviderResult,
  type VideoTaskProviderResult, type AudioProviderResult, type FailedProviderResult,
  type GenerationInputParams,
} from './domain-types'
```

- [ ] **Step 8: Write failing test `packages/shared/tests/serialize.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { serialize } from '../src/serialize'

describe('serialize', () => {
  it('converts top-level Date to ISO string', () => {
    const d = new Date('2026-06-26T00:00:00.000Z')
    expect(serialize(d)).toBe('2026-06-26T00:00:00.000Z')
  })

  it('recursively converts Date in nested objects', () => {
    const input = { id: 1, createdAt: new Date('2026-01-01T00:00:00.000Z'), nested: { at: new Date('2026-02-02T00:00:00.000Z') } }
    expect(serialize(input)).toEqual({ id: 1, createdAt: '2026-01-01T00:00:00.000Z', nested: { at: '2026-02-02T00:00:00.000Z' } })
  })

  it('converts Date inside arrays', () => {
    const input = { items: [new Date('2026-03-03T00:00:00.000Z'), 'keep'] }
    expect(serialize(input)).toEqual({ items: ['2026-03-03T00:00:00.000Z', 'keep'] })
  })

  it('passes through primitives', () => {
    expect(serialize(42)).toBe(42)
    expect(serialize('hi')).toBe('hi')
    expect(serialize(null)).toBeNull()
    expect(serialize(undefined)).toBeUndefined()
  })
})
```

- [ ] **Step 9: Run test to verify it passes**

Run: `bun test --cwd packages/shared`
Expected: PASS (4 tests). Note: serialize is pure so no fail-first needed; this verifies the impl.

- [ ] **Step 10: Verify typecheck**

Run: `bun run --cwd packages/shared typecheck`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add logger, serialize, config, domain types"
```

---

## Task 3: `@seq/db` package skeleton + client singleton

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`
- Create: `packages/db/src/client.ts`, `packages/db/src/types.ts`, `packages/db/src/index.ts`

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@seq/db",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "db:generate": "bun --env-file=../../.env drizzle-kit generate",
    "db:push": "bun --env-file=../../.env drizzle-kit push",
    "db:migrate": "bun --env-file=../../.env src/migrate.ts",
    "db:studio": "bun --env-file=../../.env drizzle-kit studio"
  },
  "dependencies": {
    "@seq/shared": "workspace:*",
    "drizzle-orm": "^0.36.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.28.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "include": ["src", "tests"] }
}
```

- [ ] **Step 3: Create `packages/db/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://sequence:sequence_dev@localhost:5432/sequence',
  },
})
```

- [ ] **Step 4: Create `packages/db/src/client.ts`**

```ts
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
```

- [ ] **Step 5: Create `packages/db/src/types.ts`**

```ts
// shim：db 包内统一从本文件 import serialize，背后复用 shared
export { serialize } from '@seq/shared'
```

- [ ] **Step 6: Create `packages/db/src/index.ts`**

```ts
export { db, getDb, setDb, resetDb } from './client'
export { serialize } from '@seq/shared'
export * as schema from './schema'
export * from './schema/index'
```

- [ ] **Step 7: Commit**

```bash
git add packages/db/package.json packages/db/tsconfig.json packages/db/drizzle.config.ts packages/db/src
git commit -m "feat(db): package skeleton + client singleton"
```

---

## Task 4: `users` schema + repository

**Files:**
- Create: `packages/db/src/schema/users.ts`
- Modify: `packages/db/src/schema/index.ts` (create, barrel)
- Create: `packages/db/src/repositories/users.repo.ts`
- Test: `packages/db/tests/users.repo.test.ts`

- [ ] **Step 1: Create `packages/db/src/schema/users.ts`**

```ts
import { pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['user', 'admin'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  /** bcrypt hash — 绝不投影进 API 响应 */
  password: varchar('password', { length: 255 }).notNull(),
  avatar: varchar('avatar', { length: 512 }),
  role: userRole('role').notNull().default('user'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

- [ ] **Step 2: Create `packages/db/src/schema/index.ts` barrel**

```ts
export * from './users'
```

(Schema for other tables is appended to this barrel in Tasks 5-7.)

- [ ] **Step 3: Write failing test `packages/db/tests/users.repo.test.ts`**

This test uses a transaction-scope DB for isolation. It requires Postgres running (started in Task 1 Step 8).

```ts
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
  it('createUser inserts and returns the row (without exposing password projection contract)', async () => {
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test --cwd packages/db tests/users.repo.test.ts`
Expected: FAIL — `users.repo` module not found.

- [ ] **Step 5: Create `packages/db/src/repositories/users.repo.ts`**

```ts
import { eq } from 'drizzle-orm'
import { db } from '../client'
import { users, type NewUser, type User } from '../schema/users'

export async function createUser(input: NewUser): Promise<User> {
  const [row] = await db.insert(users).values(input).returning()
  return row
}

export async function findUserById(id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return row ?? null
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return row ?? null
}

export async function touchLastLogin(id: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id))
}
```

- [ ] **Step 6: Generate migration and push schema**

Run: `cd packages/db && bun --env-file=../../.env drizzle-kit push`
Expected: `users` table created in Postgres. (Use `db:push` for dev; `db:migrate` generates versioned files for prod.)

- [ ] **Step 7: Run test to verify it passes**

Run: `bun test --cwd packages/db tests/users.repo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 8: Verify typecheck**

Run: `bun run --cwd packages/db typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/db/src packages/db/tests
git commit -m "feat(db): users table + repository"
```

---

## Task 5: `tasks` schema + repository (claim/lock/sweep)

**Files:**
- Create: `packages/db/src/schema/tasks.ts`
- Modify: `packages/db/src/schema/index.ts` (append export)
- Create: `packages/db/src/repositories/tasks.repo.ts`
- Test: `packages/db/tests/tasks.repo.test.ts`

- [ ] **Step 1: Create `packages/db/src/schema/tasks.ts`**

```ts
import {
  index, integer, jsonb, pgEnum, pgTable, timestamp, uuid, varchar,
} from 'drizzle-orm/pg-core'
import { TASK_STATUS, TASK_DOMAIN, type TaskErrorInfo, type TaskStatus, type TaskDomain } from '@seq/shared'

export const taskStatus = pgEnum('task_status', [
  TASK_STATUS.QUEUED, TASK_STATUS.RUNNING, TASK_STATUS.RETRYING,
  TASK_STATUS.SUCCEEDED, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED,
])

export const taskDomain = pgEnum('task_domain', [
  TASK_DOMAIN.GENERATE, TASK_DOMAIN.ANALYSIS, TASK_DOMAIN.TRANSFER,
])

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: varchar('type', { length: 60 }).notNull(),
    domain: taskDomain('domain').notNull(),
    status: taskStatus('status').notNull().default(TASK_STATUS.QUEUED),
    priority: integer('priority').notNull().default(5),
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    output: jsonb('output').$type<Record<string, unknown> | null>(),
    // claim 锁
    lockedBy: varchar('locked_by', { length: 60 }),
    lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'date' }),
    // 重试
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    nextRunAt: timestamp('next_run_at', { withTimezone: true, mode: 'date' }),
    // 错误
    errorJson: jsonb('error_json').$type<TaskErrorInfo | null>(),
    // 关联
    recordId: uuid('record_id'),
    projectId: uuid('project_id'),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({
    statusDomainIdx: index('tasks_status_domain_idx').on(t.status, t.domain),
    nextRunIdx: index('tasks_next_run_idx').on(t.nextRunAt),
    recordIdx: index('tasks_record_idx').on(t.recordId),
    projectIdx: index('tasks_project_idx').on(t.projectId),
  }),
)

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
```

> Note: foreign keys to `users`/`generation_records`/`analysis_projects` are added in the migration generated after those tables exist (Tasks 6-7 add them). For now `userId` is not a hard FK to keep this task self-contained; the push in Step 6 will create the table.

- [ ] **Step 2: Append to `packages/db/src/schema/index.ts`**

```ts
export * from './users'
export * from './tasks'
```

- [ ] **Step 3: Write failing test `packages/db/tests/tasks.repo.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../src/schema'
import { setDb, resetDb } from '../src/client'
import * as usersRepo from '../src/repositories/users.repo'
import * as tasksRepo from '../src/repositories/tasks.repo'
import { TASK_DOMAIN, TASK_STATUS } from '@seq/shared'

let pool: Pool
let userId: string

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  setDb(drizzle(pool, { schema }))
  const u = await usersRepo.createUser({ username: 'tasker', email: 'tasker@example.com', password: 'h' })
  userId = u.id
})

afterAll(() => resetDb())

beforeEach(async () => {
  await pool.query('TRUNCATE tasks RESTART IDENTITY CASCADE')
})

describe('tasks.repo', () => {
  it('createTask inserts a queued task', async () => {
    const t = await tasksRepo.createTask({ userId, type: 'generate.video', domain: TASK_DOMAIN.GENERATE, input: { model: 'x' } })
    expect(t.status).toBe(TASK_STATUS.QUEUED)
    expect(t.attempts).toBe(0)
  })

  it('claimNextTask locks and returns the highest-priority eligible task, or null', async () => {
    await tasksRepo.createTask({ userId, type: 'a', domain: TASK_DOMAIN.GENERATE, input: {}, priority: 5 })
    await tasksRepo.createTask({ userId, type: 'b', domain: TASK_DOMAIN.GENERATE, input: {}, priority: 3 })
    const claimed = await tasksRepo.claimNextTask('worker-1', 60_000)
    expect(claimed).not.toBeNull()
    expect(claimed!.type).toBe('b') // priority 3 < 5 → claimed first
    expect(claimed!.lockedBy).toBe('worker-1')
    expect(claimed!.status).toBe(TASK_STATUS.RUNNING)
  })

  it('claimNextTask returns null when nothing eligible', async () => {
    expect(await tasksRepo.claimNextTask('worker-1', 60_000)).toBeNull()
  })

  it('claimNextTask skips running/locked tasks', async () => {
    await tasksRepo.createTask({ userId, type: 'a', domain: TASK_DOMAIN.GENERATE, input: {}, priority: 5 })
    await tasksRepo.claimNextTask('worker-1', 60_000) // locks it
    expect(await tasksRepo.claimNextTask('worker-2', 60_000)).toBeNull()
  })

  it('extendTaskLock pushes lockedUntil forward', async () => {
    const t = await tasksRepo.createTask({ userId, type: 'a', domain: TASK_DOMAIN.GENERATE, input: {} })
    await tasksRepo.claimNextTask('worker-1', 60_000)
    const extended = await tasksRepo.extendTaskLock(t.id, 'worker-1', 120_000)
    expect(extended?.lockedBy).toBe('worker-1')
  })

  it('sweepOrphanTasks resets tasks whose lock expired', async () => {
    const t = await tasksRepo.createTask({ userId, type: 'a', domain: TASK_DOMAIN.GENERATE, input: {} })
    // 直接置为运行中 + 过期锁
    await tasksRepo.markRunningForTest(t.id, 'dead-worker', new Date(Date.now() - 10 * 60 * 1000))
    const swept = await tasksRepo.sweepOrphanTasks(5)
    expect(swept).toBeGreaterThanOrEqual(1)
    const after = await tasksRepo.findTaskById(t.id)
    expect(after?.status).toBe(TASK_STATUS.QUEUED)
    expect(after?.lockedBy).toBeNull()
  })

  it('markSucceeded updates status + output', async () => {
    const t = await tasksRepo.createTask({ userId, type: 'a', domain: TASK_DOMAIN.GENERATE, input: {} })
    const updated = await tasksRepo.markSucceeded(t.id, { video_url: 'http://x' })
    expect(updated?.status).toBe(TASK_STATUS.SUCCEEDED)
    expect(updated?.output).toEqual({ video_url: 'http://x' })
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test --cwd packages/db tests/tasks.repo.test.ts`
Expected: FAIL — `tasks.repo` module not found.

- [ ] **Step 5: Create `packages/db/src/repositories/tasks.repo.ts`**

```ts
import { and, desc, eq, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { tasks, type NewTask, type Task } from '../schema/tasks'
import { TASK_STATUS } from '@seq/shared'

export async function createTask(input: NewTask): Promise<Task> {
  const [row] = await db.insert(tasks).values(input).returning()
  return row
}

export async function findTaskById(id: string): Promise<Task | null> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
  return row ?? null
}

/**
 * 领取下一个可执行任务 — FOR UPDATE SKIP LOCKED。
 * 筛选 queued（或 retrying 到期），按 priority 升序、createdAt 升序，加行锁，
 * 置 running + lockedBy + lockedUntil。返回 null 表示无 eligible。
 */
export async function claimNextTask(workerId: string, claimTtlMs: number): Promise<Task | null> {
  const eligible = and(
    or(eq(tasks.status, TASK_STATUS.QUEUED), and(eq(tasks.status, TASK_STATUS.RETRYING), lte(tasks.nextRunAt, new Date()))),
    isNull(tasks.lockedBy),
  )
  const [claimed] = await db
    .select()
    .from(tasks)
    .where(eligible)
    .orderBy(tasks.priority, tasks.createdAt)
    .limit(1)
    .for('update skip locked')

  if (!claimed) return null

  const lockedUntil = new Date(Date.now() + claimTtlMs)
  const [updated] = await db
    .update(tasks)
    .set({ status: TASK_STATUS.RUNNING, lockedBy: workerId, lockedUntil, updatedAt: new Date() })
    .where(and(eq(tasks.id, claimed.id), eq(tasks.lockedBy, null as unknown as string)))
    .returning()
  return updated ?? claimed
}

/** heartbeat：续锁。返回 null 表示锁已丢（被 sweep/cancel）。 */
export async function extendTaskLock(id: string, workerId: string, claimTtlMs: number): Promise<Task | null> {
  const lockedUntil = new Date(Date.now() + claimTtlMs)
  const [updated] = await db
    .update(tasks)
    .set({ lockedUntil, updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.lockedBy, workerId)))
    .returning()
  return updated ?? null
}

/** 清扫锁过期 > timeoutMinutes 的 running 任务，重置为 queued。返回清扫数。 */
export async function sweepOrphanTasks(timeoutMinutes = 5): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000)
  const result = await db
    .update(tasks)
    .set({ status: TASK_STATUS.QUEUED, lockedBy: null, lockedUntil: null, updatedAt: new Date() })
    .where(and(eq(tasks.status, TASK_STATUS.RUNNING), lt(tasks.lockedUntil, cutoff)))
    .returning({ id: tasks.id })
  return result.length
}

export async function markSucceeded(id: string, output: Record<string, unknown>): Promise<Task | null> {
  const [row] = await db
    .update(tasks)
    .set({ status: TASK_STATUS.SUCCEEDED, output, lockedBy: null, lockedUntil: null, errorJson: null, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning()
  return row ?? null
}

export async function markRetrying(id: string, nextRunAt: Date): Promise<Task | null> {
  const [row] = await db
    .update(tasks)
    .set({ status: TASK_STATUS.RETRYING, nextRunAt, lockedBy: null, lockedUntil: null, attempts: sql`${tasks.attempts} + 1`, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning()
  return row ?? null
}

export async function markFailed(id: string, errorJson: Record<string, unknown>, errorMessage: string): Promise<Task | null> {
  const [row] = await db
    .update(tasks)
    .set({ status: TASK_STATUS.FAILED, errorJson: { ...errorJson, message: errorMessage }, lockedBy: null, lockedUntil: null, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning()
  return row ?? null
}

export async function cancelTask(id: string): Promise<Task | null> {
  const [row] = await db
    .update(tasks)
    .set({ status: TASK_STATUS.CANCELLED, lockedBy: null, lockedUntil: null, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning()
  return row ?? null
}

/** 测试辅助：直接置为运行中 + 指定锁状态（模拟孤儿）。 */
export async function markRunningForTest(id: string, workerId: string, lockedUntil: Date): Promise<void> {
  await db.update(tasks).set({ status: TASK_STATUS.RUNNING, lockedBy: workerId, lockedUntil }).where(eq(tasks.id, id))
}

/** 列出某 record/project 关联的任务（按创建序）。 */
export async function findTasksByRecord(recordId: string): Promise<Task[]> {
  return db.select().from(tasks).where(eq(tasks.recordId, recordId)).orderBy(desc(tasks.createdAt))
}
```

- [ ] **Step 6: Push schema (creates tasks table + enums)**

Run: `cd packages/db && bun --env-file=../../.env drizzle-kit push`
Expected: `tasks` table + `task_status`/`task_domain` enums created.

- [ ] **Step 7: Run test to verify it passes**

Run: `bun test --cwd packages/db tests/tasks.repo.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 8: Verify typecheck**

Run: `bun run --cwd packages/db typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/db/src packages/db/tests
git commit -m "feat(db): tasks queue table + claim/lock/sweep repository"
```

---

## Task 6: `generation` + `analysis` + `transfer` + `uploads` schemas

**Files:**
- Create: `packages/db/src/schema/generation.ts`, `analysis.ts`, `transfer.ts`, `uploads.ts`
- Modify: `packages/db/src/schema/index.ts` (append exports)
- Modify: `packages/db/src/schema/tasks.ts` (add FK references now that targets exist)
- Create: `packages/db/src/repositories/generation.repo.ts`, `analysis.repo.ts`
- Test: `packages/db/tests/generation.repo.test.ts`

- [ ] **Step 1: Create `packages/db/src/schema/generation.ts`**

```ts
import {
  integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { TASK_STATUS, type GenerationInputParams } from '@seq/shared'

export const recordStatus = pgEnum('record_status', [
  'submitting', 'processing', 'saving_output', 'succeeded', 'failed', 'cancelled',
])

export const generationRecords = pgTable(
  'generation_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    model: varchar('model', { length: 60 }).notNull(),
    category: varchar('category', { length: 20 }).notNull(),
    subCategory: varchar('sub_category', { length: 40 }).notNull(),
    inputParams: jsonb('input_params').$type<GenerationInputParams>().notNull(),
    outputResult: jsonb('output_result').$type<Record<string, unknown> | null>(),
    status: recordStatus('status').notNull().default('submitting'),
    cost: jsonb('cost').$type<Record<string, unknown> | null>(),
    dedupeKey: varchar('dedupe_key', { length: 255 }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: uniqueIndex('gen_records_user_created_idx').on(t.userId, t.createdAt),
    dedupeIdx: uniqueIndex('gen_records_dedupe_idx').on(t.dedupeKey),
  }),
)

export const generationFiles = pgTable(
  'generation_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recordId: uuid('record_id').notNull().references(() => generationRecords.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 30 }).notNull(),
    sourceUrl: varchar('source_url', { length: 1024 }),
    storagePath: varchar('storage_path', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }),
    sizeBytes: integer('size_bytes'),
    originalFilename: varchar('original_filename', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
)

export type GenerationRecord = typeof generationRecords.$inferSelect
export type NewGenerationRecord = typeof generationRecords.$inferInsert
export type GenerationFile = typeof generationFiles.$inferSelect
```

- [ ] **Step 2: Create `packages/db/src/schema/analysis.ts`**

```ts
import { jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import { tasks } from './tasks'

export const analysisStepName = pgEnum('analysis_step', ['asr', 'script'])

export const analysisProjects = pgTable('analysis_projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoUrl: varchar('video_url', { length: 1024 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  currentStep: analysisStepName('current_step'),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export const analysisSteps = pgTable('analysis_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => analysisProjects.id, { onDelete: 'cascade' }),
  step: analysisStepName('step').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | running | succeeded | failed
  result: jsonb('result').$type<Record<string, unknown> | null>(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export type AnalysisProject = typeof analysisProjects.$inferSelect
export type NewAnalysisProject = typeof analysisProjects.$inferInsert
export type AnalysisStep = typeof analysisSteps.$inferSelect
```

- [ ] **Step 3: Create `packages/db/src/schema/transfer.ts`**

```ts
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const transferSessions = pgTable('transfer_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  peerCode: varchar('peer_code', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export type TransferSession = typeof transferSessions.$inferSelect
export type NewTransferSession = typeof transferSessions.$inferInsert
```

- [ ] **Step 4: Create `packages/db/src/schema/uploads.ts`**

```ts
import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const uploadedFiles = pgTable('uploaded_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: varchar('purpose', { length: 30 }).notNull(),
  storagePath: varchar('storage_path', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  originalFilename: varchar('original_filename', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export type UploadedFile = typeof uploadedFiles.$inferSelect
export type NewUploadedFile = typeof uploadedFiles.$inferInsert
```

- [ ] **Step 5: Update `packages/db/src/schema/index.ts` barrel**

```ts
export * from './users'
export * from './tasks'
export * from './generation'
export * from './analysis'
export * from './transfer'
export * from './uploads'

/** 聚合表 map，便于批量 import / drizzle-typebox 工具 */
export const table = {
  users,
  tasks,
  generationRecords,
  generationFiles,
  analysisProjects,
  analysisSteps,
  transferSessions,
  uploadedFiles,
} as const
```

Add the missing imports at top of `index.ts`:

```ts
import { users } from './users'
import { tasks } from './tasks'
import { generationRecords, generationFiles } from './generation'
import { analysisProjects, analysisSteps } from './analysis'
import { transferSessions } from './transfer'
import { uploadedFiles } from './uploads'
```

- [ ] **Step 6: Write failing test `packages/db/tests/generation.repo.test.ts`**

```ts
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
```

- [ ] **Step 7: Run test to verify it fails**

Run: `bun test --cwd packages/db tests/generation.repo.test.ts`
Expected: FAIL — `generation.repo` module not found.

- [ ] **Step 8: Create `packages/db/src/repositories/generation.repo.ts`**

```ts
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../client'
import { generationRecords, generationFiles, type NewGenerationRecord, type GenerationRecord, type GenerationFile } from '../schema/generation'

export async function createRecord(input: NewGenerationRecord): Promise<GenerationRecord> {
  const [row] = await db.insert(generationRecords).values(input).returning()
  return row
}

export async function findRecordById(id: string): Promise<{ record: GenerationRecord; files: GenerationFile[] } | null> {
  const [record] = await db.select().from(generationRecords).where(eq(generationRecords.id, id)).limit(1)
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
  const [row] = await db.update(generationRecords).set({ status, ...patch, updatedAt: new Date() }).where(eq(generationRecords.id, id)).returning()
  return row ?? null
}

export async function addFile(input: { recordId: string; kind: string; storagePath: string; mimeType?: string; sizeBytes?: number; sourceUrl?: string; originalFilename?: string }): Promise<GenerationFile> {
  const [row] = await db.insert(generationFiles).values(input).returning()
  return row
}

export async function softDelete(id: string): Promise<void> {
  await db.update(generationRecords).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(generationRecords.id, id))
}
```

- [ ] **Step 9: Create `packages/db/src/repositories/analysis.repo.ts`**

```ts
import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../client'
import { analysisProjects, analysisSteps, type NewAnalysisProject, type AnalysisProject, type AnalysisStep } from '../schema/analysis'

export async function createProject(input: NewAnalysisProject): Promise<AnalysisProject> {
  const [row] = await db.insert(analysisProjects).values(input).returning()
  return row
}

export async function findProjectById(id: string): Promise<AnalysisProject | null> {
  const [row] = await db.select().from(analysisProjects).where(eq(analysisProjects.id, id)).limit(1)
  return row ?? null
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
  const [existing] = await db
    .select()
    .from(analysisSteps)
    .where(and(eq(analysisSteps.projectId, projectId), eq(analysisSteps.step, step)))
    .limit(1)
  if (existing) {
    const [updated] = await db.update(analysisSteps).set({ ...patch, updatedAt: new Date() }).where(eq(analysisSteps.id, existing.id)).returning()
    return updated
  }
  const [created] = await db.insert(analysisSteps).values({ projectId, step, ...patch }).returning()
  return created
}
```

- [ ] **Step 10: Push schema (creates all remaining tables + FKs)**

Run: `cd packages/db && bun --env-file=../../.env drizzle-kit push`
Expected: `generation_records`, `generation_files`, `analysis_projects`, `analysis_steps`, `transfer_sessions`, `uploaded_files` created with FKs.

- [ ] **Step 11: Run test to verify it passes**

Run: `bun test --cwd packages/db tests/generation.repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 12: Run full db test suite**

Run: `bun test --cwd packages/db`
Expected: all tests pass (users + tasks + generation).

- [ ] **Step 13: Verify typecheck**

Run: `bun run --cwd packages/db typecheck`
Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add packages/db
git commit -m "feat(db): generation/analysis/transfer/uploads schemas + repositories"
```

---

## Task 7: `migrate.ts` entrypoint + final wiring + CLAUDE.md

**Files:**
- Create: `packages/db/src/migrate.ts`
- Create: `packages/db/drizzle/0000_initial.sql` (generated)
- Create: root `CLAUDE.md`

- [ ] **Step 1: Create `packages/db/src/migrate.ts`**

```ts
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
```

- [ ] **Step 2: Generate versioned migration (for prod)**

Run: `cd packages/db && bun --env-file=../../.env drizzle-kit generate`
Expected: creates `packages/db/drizzle/0000_*.sql` + `meta/` snapshot.

- [ ] **Step 3: Verify migrate script runs on a fresh DB**

Run: `docker compose down -v && docker compose up -d db` (reset DB), then `cd packages/db && bun --env-file=../../.env src/migrate.ts`
Expected: `[db] migrations applied`. Then `bun test --cwd packages/db` passes on the fresh DB.

- [ ] **Step 4: Create root `CLAUDE.md`**

```markdown
# CLAUDE.md

**sequence** — uhyc v2 全功能 AI 媒体平台（生成工坊 / 视频拆解分析成剧本 / P2P 传输）。Bun workspace monorepo，单体 Elysia 后端 + 独立 worker 进程。

## Commands

```bash
bun run dev          # turbo dev（api + worker + 前端）
bun run build        # turbo build
bun run typecheck    # 跨包类型检查
bun run test         # 跨包测试
bun run db:push      # 推 schema（开发）
bun run db:migrate   # 版本化迁移（生产）
bun run db:test      # 仅 db 包测试（需 PG）

# 单包测试
bun test --cwd packages/db
bun test --cwd packages/db tests/tasks.repo.test.ts
```

## Architecture

- **packages/**（非业务，专注单一职责）：`shared`(BASE) / `bailian-core`(纯契约+校验) / `bailian-client`(纯HTTP) / `task-engine`(纯任务生命周期) / `db`(运行时数据) / `storage`(运行时文件)
- **services/**：`api`(单体 Elysia :3000) / `worker`(任务轮询 :3001 health)
- **apps/**：`generate` / `analysis` / `transfer`（前端，模板手动创建）

**纯包纪律**：`bailian-core`/`bailian-client`/`task-engine` 只依赖 `shared`，绝不 import `db`/`storage`。声明 `*Adapter` 接口，由 services 注入实现。

## Key patterns

- **类型推导链**：Drizzle schema → InferSelectModel → serialize()(Date→ISO) → API 类型。单向，无重复。
- **JSONB 强类型**：列用 `$type<T>()` 附着领域类型。
- **统一任务队列**：`tasks` 表是唯一异步执行层，`FOR UPDATE SKIP LOCKED` claim + 锁 + heartbeat + 孤儿清扫。生命周期决策走 `@seq/task-engine`。
- **DB 迁移脚本用 `bun --env-file=../../.env`**（直接执行文件），不是 `bun run`。

## 参考

- 架构设计：`docs/superpowers/specs/2026-06-26-sequence-v2-architecture-design.md`
```

- [ ] **Step 5: Run full repo typecheck + test**

Run: `bun run typecheck && bun run db:test`
Expected: typecheck clean, all db tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrate.ts packages/db/drizzle CLAUDE.md
git commit -m "feat(db): migrate entrypoint + versioned migration + CLAUDE.md"
```

---

## Self-Review Notes

**Spec coverage (this plan):**
- §1.1 monorepo layout → Task 1 ✓
- §1.3 `@seq/shared` + `@seq/db` contracts → Tasks 2-7 ✓
- §2.1 all 8 tables → users(T4), tasks(T5), generation/analysis/transfer/uploads(T6) ✓
- §2.2 tasks queue + claim/lock/sweep → T5 ✓
- §2.4 serialize + `$type<T>()` typed JSONB → T2 (serialize), T5/T6 (`$type`) ✓

**Out of scope (future plans):** bailian-core/client, task-engine, storage, services/api, services/worker, frontend. The roadmap in the spec lists these as phases 3-8; each gets its own plan.

**Type consistency:** `Task`/`NewTask` (T5) used consistently; `GenerationRecord`/`AnalysisProject` (T6) match barrel exports in T6 Step 5. `TASK_STATUS`/`TASK_DOMAIN` constants defined in shared (T2) and reused in db schema (T5) and tests.
