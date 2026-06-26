# Phase 6: services/api Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `services/api` — the single Elysia backend (:3000) that wires together all six packages. It serves auth, catalog (model registry), generate, analysis, transfer, upload, and health routes; uses the factory-route + ServerConfig pattern (injected, testable); throws typed `AppError` subclasses handled by a global `onError`; and exports `type App` for Eden treaty end-to-end typing.

**Architecture:** Monorepo service depending on all packages. Routes grouped by domain module under `src/modules/`; cross-cutting (auth plugin, AppError, errorHandler, ServerConfig) under `src/plugins` + `src/lib`. The 30-model `ModelConfig` registry lives in `src/modules/generate/registry/` (business data, per spec §1.3). DB access goes through `@seq/db` repositories; file ops through `@seq/storage`; provider calls through `@seq/bailian-client`; validation through `@seq/bailian-core`. Worker is separate (Phase 7) — api only creates tasks (status queued) and reads state; it does NOT poll.

**Tech Stack:** Elysia (catalog version), `@elysia/jwt`, `@elysia/cors`, `@elysia/openapi`, `bcryptjs` (or `Bun.password`), Eden treaty types. Bun runtime, `bun --env-file=../../.env` for dev.

**Reference spec:** `docs/superpowers/specs/2026-06-26-sequence-v2-architecture-design.md` (§3 API 契约).
**Reference source:** `/Users/yxswy/Documents/uhyc/services/api/` (auth plugin, services) — port auth logic; apply v2 improvements (AppError instead of status-sniffing).

**Scope:** Phase 6 = api only. Worker (Phase 7) consumes the same tasks table. Frontend (Phase 8) is user-manual.

---

## File Structure

### Service skeleton + cross-cutting
- `services/api/package.json`, `tsconfig.json`
- `src/index.ts` — app assembly, listen(:3000), export `type App`
- `src/config.ts` — `ServerConfig` (typed, from env) + `loadServerConfig()`
- `src/plugins/auth.ts` — `authPlugin` (jwt cookie + `isAuth` macro + `currentUser`)
- `src/lib/app-errors.ts` — `AppError` + subclasses + `errorHandlerPlugin`
- `src/lib/storage-factory.ts` — `getAssetStorage()` singleton from ServerConfig

### Modules (each: `routes.ts` + `service.ts`)
- `src/modules/auth/` — routes + service (register/login/me/logout)
- `src/modules/catalog/` — routes (returns registry); `registry/index.ts` aggregates
- `src/modules/generate/` — routes + service + `registry/` (ModelConfig files) + `to-response.ts`
- `src/modules/analysis/` — routes + service
- `src/modules/transfer/` — routes + service (session CRUD; WS signaling is Phase 7-lite)
- `src/modules/upload/` — routes + service
- `src/modules/health/` — routes (/live, /ready, /db)

### Tests
- `tests/helpers/test-factory.ts` — `makeAccount`, `signTestToken`, `makeTestConfig`, `extractEdenError`
- `tests/auth.test.ts`, `tests/catalog.test.ts`, `tests/generate.test.ts`, `tests/analysis.test.ts`, `tests/health.test.ts`

---

## Task 1: service skeleton + ServerConfig + AppError + errorHandler + auth plugin

**Files:**
- Create: `services/api/package.json`, `tsconfig.json`, `src/config.ts`, `src/lib/app-errors.ts`, `src/plugins/auth.ts`

- [ ] **Step 1: Create `services/api/package.json`**

```json
{
  "name": "@seq/api",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "bun --env-file=../../.env run src/index.ts",
    "start": "bun run src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "bun --env-file=../../.env test"
  },
  "dependencies": {
    "@elysia/cors": "^1.4.2",
    "@elysia/jwt": "^1.4.2",
    "@elysia/openapi": "^1.4.15",
    "@seq/shared": "workspace:*",
    "@seq/db": "workspace:*",
    "@seq/storage": "workspace:*",
    "@seq/bailian-core": "workspace:*",
    "@seq/bailian-client": "workspace:*",
    "elysia": "catalog:"
  },
  "devDependencies": { "typescript": "^5.6.0" }
}
```

- [ ] **Step 2: Create `services/api/tsconfig.json`**

```json
{
  "extends": ["../../tsconfig.base.json"],
  "compilerOptions": { "types": ["bun"] },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `src/config.ts`** — typed ServerConfig for injectable routes

```ts
import { loadConfig, type AppConfig } from '@seq/shared'

/** 服务端配置 — 路由组显式接收而非读 process.env，便于测试注入。 */
export interface ServerConfig {
  port: number
  corsOrigin: string[]
  nodeEnv: string
  app: AppConfig
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3000),
    corsOrigin: (env.CORS_ORIGIN ?? 'http://localhost:5174').split(','),
    nodeEnv: env.NODE_ENV ?? 'development',
    app: loadConfig(env),
  }
}
```

- [ ] **Step 4: Create `src/lib/app-errors.ts`** — typed errors + global handler (replaces v1 status-sniffing)

```ts
import { Elysia } from 'elysia'

/** 统一错误基类 — 路由 throw 子类，全局 onError 序列化。 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number
  abstract readonly code: string
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class BadRequestError extends AppError { readonly statusCode = 400; readonly code = 'BAD_REQUEST' }
export class UnauthorizedError extends AppError { readonly statusCode = 401; readonly code = 'UNAUTHORIZED' }
export class ForbiddenError extends AppError { readonly statusCode = 403; readonly code = 'FORBIDDEN' }
export class NotFoundError extends AppError { readonly statusCode = 404; readonly code = 'NOT_FOUND' }
export class ConflictError extends AppError { readonly statusCode = 409; readonly code = 'CONFLICT' }
export class ValidationError extends AppError {
  readonly statusCode = 422
  readonly code = 'VALIDATION'
  constructor(message: string, readonly errors?: unknown) { super(message) }
}
export class InternalError extends AppError { readonly statusCode = 500; readonly code = 'INTERNAL' }

/** 全局错误处理 plugin — 序列化所有 AppError 子类为 { error, code, message }。 */
export const errorHandlerPlugin = new Elysia({ name: 'error-handler' }).onError(({ error, set }) => {
  if (error instanceof AppError) {
    set.status = error.statusCode
    return {
      error: error.code,
      code: error.code,
      message: error.message,
      ...(error instanceof ValidationError && error.errors ? { errors: error.errors } : {}),
    }
  }
  set.status = 500
  return { error: 'INTERNAL', code: 'INTERNAL', message: error instanceof Error ? error.message : String(error) }
})
```

- [ ] **Step 5: Create `src/plugins/auth.ts`** — port v1 auth plugin (jwt cookie + isAuth macro)

```ts
import { Elysia, status, t } from 'elysia'
import { jwt } from '@elysia/jwt'

const AUTH_COOKIE = 'auth'

export interface CurrentUser {
  id: string
  role: 'user' | 'admin'
}

/**
 * Auth plugin — 注册 jwt helper + isAuth 宏。
 * 路由组用 { isAuth: true } 要求鉴权，成功注入 currentUser。
 */
export function createAuthPlugin(secret: string) {
  return new Elysia({ name: 'auth' })
    .use(
      jwt({
        name: 'jwt',
        secret,
        schema: t.Object({
          sub: t.String(),
          role: t.Union([t.Literal('user'), t.Literal('admin')]),
        }),
        exp: '7d',
      }),
    )
    .macro({
      isAuth: {
        resolve: async ({ cookie, jwt }): Promise<{ currentUser?: CurrentUser } | { status: unknown }> => {
          const token = cookie[AUTH_COOKIE].value
          const payload = token ? await jwt.verify(token) : false
          if (!payload) return status(401, { error: 'Unauthorized' })
          return { currentUser: { id: payload.sub, role: payload.role } }
        },
      },
    })
}

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
}

export const AUTH_COOKIE_NAME = AUTH_COOKIE

/** 签发 JWT（service 层用）。 */
export async function signUserToken(jwt: { sign: (p: unknown) => Promise<string> }, user: { id: string; role: 'user' | 'admin' }): Promise<string> {
  return jwt.sign({ sub: user.id, role: user.role })
}
```

- [ ] **Step 6: Verify typecheck**

Run: `cd services/api && bun install && bun run typecheck`
Expected: clean (some files reference not-yet-created modules, but these files are self-contained; if errors about missing imports appear, they're expected until Task 8 wires index.ts).

- [ ] **Step 7: Commit**

```bash
git add -A && git -c user.name="sequence" -c user.email="dev@sequence.local" commit -m "feat(api): skeleton + ServerConfig + AppError + errorHandler + auth plugin"
```

---

## Task 2: auth module (register / login / me / logout)

**Files:**
- Create: `src/modules/auth/service.ts`, `src/modules/auth/routes.ts`
- Test: `tests/helpers/test-factory.ts`, `tests/auth.test.ts`

- [ ] **Step 1: Create `tests/helpers/test-factory.ts`**

```ts
import { treaty } from '@elysia/eden'
import type { App } from '../../src/index'
import type { ServerConfig } from '../../src/config'

/** 用最小 Elysia 实例 + treaty 测试路由组。 */
export function makeTestConfig(): ServerConfig {
  return {
    port: 0,
    corsOrigin: ['*'],
    nodeEnv: 'test',
    app: {
      databaseUrl: process.env.DATABASE_URL!,
      jwtSecret: 'test-secret',
      bailianApiKey: 'test-key',
      bailianBaseUrl: 'https://example.com',
      storageDir: './.tmp-test-storage',
    },
  }
}

/** 创建用户（直连 repo，绕过路由）。 */
export async function makeAccount(input: { username: string; email: string; password?: string; role?: 'user' | 'admin' }) {
  const { createUser } = await import('@seq/db')
  const passwordHash = await Bun.password.hash(input.password ?? 'password123')
  return createUser({ username: input.username, email: input.email, password: passwordHash, role: input.role })
}

/** Eden treaty helper：从 { data, error } 提取 data 或抛结构化错误。 */
export function extractEdenError<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}
```

> NOTE: test-factory imports `App` type from `src/index.ts` which doesn't exist until Task 8. Auth tests in this task create a *minimal* Elysia instance mounting only the auth plugin + auth routes, and use treaty against THAT instance (not the full App). This keeps auth tests decoupled from the full app wiring. Adjust the treaty generic to the minimal instance type.

- [ ] **Step 2: Create `src/modules/auth/service.ts`**

```ts
import { eq, or } from 'drizzle-orm'
import { db, users } from '@seq/db'
import { ConflictError, UnauthorizedError } from '../../lib/app-errors'

export interface AuthUserResponse {
  id: string
  username: string
  email: string
  avatar: string | null
  role: 'user' | 'admin'
  lastLoginAt: string | null
}

function toResponse(u: typeof users.$inferSelect): AuthUserResponse {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    avatar: u.avatar,
    role: u.role,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  }
}

export async function registerUser(input: { username: string; email: string; password: string }): Promise<AuthUserResponse> {
  const { createUser, findUserByEmail, findUserByUsername } = await import('@seq/db')
  // 重复检查
  const [byUsername] = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1)
  if (byUsername) throw new ConflictError('用户名已被使用')
  const [byEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1)
  if (byEmail) throw new ConflictError('邮箱已被使用')

  const passwordHash = await Bun.password.hash(input.password)
  const created = await createUser({ username: input.username, email: input.email, password: passwordHash })
  return toResponse(created)
}

export async function loginUser(input: { email: string; password: string }): Promise<{ user: AuthUserResponse; token: string; sign: (jwt: { sign: (p: unknown) => Promise<string> }) => Promise<string> }> {
  const { findUserByEmail, touchLastLogin } = await import('@seq/db')
  const user = await findUserByEmail(input.email)
  if (!user) throw new UnauthorizedError('邮箱或密码错误')
  const ok = await Bun.password.verify(input.password, user.password)
  if (!ok) throw new UnauthorizedError('邮箱或密码错误')
  await touchLastLogin(user.id)
  return {
    user: toResponse(user),
    token: '',
    sign: (jwt) => jwt.sign({ sub: user.id, role: user.role }),
  }
}

export async function getUserById(id: string): Promise<AuthUserResponse> {
  const { findUserById } = await import('@seq/db')
  const user = await findUserById(id)
  if (!user) throw new UnauthorizedError('用户不存在')
  return toResponse(user)
}
```

> NOTE: dynamic imports of repo functions inside methods avoid a barrel-export mismatch; if `@seq/db` exports the repo functions directly, use static imports. Check `packages/db/src/index.ts` — it exports `* as schema` and the client; repo functions are NOT re-exported from the barrel. **Add re-exports** to `packages/db/src/index.ts`: `export * from './repositories/users.repo'` etc. Do this as a sub-step before Task 2 Step 1.

- [ ] **Step 3: Add repo re-exports to `packages/db/src/index.ts`**

Append:
```ts
export * from './repositories/users.repo'
export * from './repositories/tasks.repo'
export * from './repositories/generation.repo'
export * from './repositories/analysis.repo'
```

- [ ] **Step 4: Create `src/modules/auth/routes.ts`** — factory route

```ts
import { Elysia, t } from 'elysia'
import { createAuthPlugin, AUTH_COOKIE_OPTIONS, AUTH_COOKIE_NAME, signUserToken } from '../../plugins/auth'
import { registerUser, loginUser, getUserById } from './service'
import { BadRequestError } from '../../lib/app-errors'

export function createAuthRoutes(secret: string) {
  return new Elysia({ prefix: '/api/auth' })
    .use(createAuthPlugin(secret))
    .post('/register', async ({ body, cookie, jwt }) => {
      const user = await registerUser(body as { username: string; email: string; password: string })
      const token = await signUserToken(jwt, user)
      cookie[AUTH_COOKIE_NAME].set({ ...AUTH_COOKIE_OPTIONS, value: token })
      return { user }
    }, { body: t.Object({ username: t.String(), email: t.String(), password: t.String() }) })
    .post('/login', async ({ body, cookie, jwt }) => {
      const { user, sign } = await loginUser(body as { email: string; password: string })
      const token = await sign(jwt)
      cookie[AUTH_COOKIE_NAME].set({ ...AUTH_COOKIE_OPTIONS, value: token })
      return { user }
    }, { body: t.Object({ email: t.String(), password: t.String() }) })
    .get('/me', ({ currentUser }) => getUserById(currentUser.id), { isAuth: true })
    .post('/logout', ({ cookie }) => {
      cookie[AUTH_COOKIE_NAME].remove()
      return { ok: true }
    })
}
```

- [ ] **Step 5: Write test `tests/auth.test.ts`** (minimal instance + treaty)

Test behaviors: register→returns user+sets cookie; register duplicate→409; login wrong password→401; me without auth→401; me with auth→user; logout clears cookie. Use `makeAccount` to seed, sign token via the plugin's jwt for the me test.

- [ ] **Step 6: Run test, fix, commit**

```bash
cd services/api && bun --env-file=../../.env test tests/auth.test.ts
git add -A && git commit -m "feat(api): auth module (register/login/me/logout) + test-factory"
```

---

## Task 3: catalog module + generate model registry (port v1's ~30 models)

**Files:**
- Create: `src/modules/generate/registry/*.ts` (one file per model, ported from v1 `packages/bailian/src/{video,image,music}/models/`)
- Create: `src/modules/generate/registry/index.ts` — aggregates into `ALL_MODELS: ModelConfig[]`
- Create: `src/modules/catalog/routes.ts`

- [ ] **Step 1: Port model configs from v1.**

For each v1 `ModelDefinition` in `/Users/yxswy/Documents/uhyc/packages/bailian/src/{video,image,music}/models/*.ts`, create a v2 `ModelConfig` under `services/api/src/modules/generate/registry/`. Map v1→v2:
  - `fields` → `parameters` (rename `key`→`name`, drop `group`/`apiKey`)
  - add `requestType` (video-synthesis→`video-t2v`/`video-media`; multimodal/image→`image`; audio→`audio`)
  - add `inputMapping` (prompt→prompt; negative_prompt→mediaField `negative_prompt`; resolution/ratio/duration/seed/etc→parameter; media slots→media with mediaType=slot.type; referenceMediaType for r2v)
  - keep `pricing`, `endpoint`, `async`, `category`, `subCategory`, `displayName`, `id`, `model`, `supportedModels`, `refSyntax`

Group into files mirroring v1: `registry/video/wan2.7.ts`, `registry/video/happyhorse.ts`, etc., OR one file per category. **Run `assertModelConfigConsistent` on each in the registry barrel test (Task 7) to catch mapping gaps.**

- [ ] **Step 2: Create `src/modules/generate/registry/index.ts`**

```ts
import { assertModelConfigConsistent, type ModelConfig } from '@seq/bailian-core'
import { wan27T2v } from './video/wan2.7-t2v'
// ... all imports
export const ALL_MODELS: ModelConfig[] = [wan27T2v, /* ... */]
// 启动时自检（也可放到 index.ts 启动校验）
for (const m of ALL_MODELS) assertModelConfigConsistent(m)
export function findModel(category: string, subCategory: string, model: string): ModelConfig | undefined {
  return ALL_MODELS.find((m) => m.category === category && m.subCategory === subCategory && m.model === model)
}
```

- [ ] **Step 3: Create `src/modules/catalog/routes.ts`**

```ts
import { Elysia } from 'elysia'
import { ALL_MODELS } from '../generate/registry'

export function createCatalogRoutes() {
  return new Elysia({ prefix: '/api' }).get('/catalog', () => ({ models: ALL_MODELS }))
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(api): catalog + model registry (30 ModelConfigs ported from v1)"
```

---

## Task 4: generate module (create task + list/get/retry/cancel/delete records)

**Files:**
- Create: `src/modules/generate/service.ts`, `src/modules/generate/routes.ts`, `src/modules/generate/to-response.ts`

- [ ] **Step 1: Create `src/modules/generate/to-response.ts`** — serialize record+files+task

```ts
import { serialize } from '@seq/shared'
import type { GenerationRecord, GenerationFile, Task } from '@seq/db'

export function toRecordResponse(record: GenerationRecord, files: GenerationFile[] = []) {
  return serialize({
    id: record.id,
    userId: record.userId,
    model: record.model,
    category: record.category,
    subCategory: record.subCategory,
    inputParams: record.inputParams,
    outputResult: record.outputResult,
    status: record.status,
    cost: record.cost,
    dedupeKey: record.dedupeKey,
    files: files.map((f) => ({ id: f.id, kind: f.kind, sourceUrl: f.sourceUrl, storagePath: f.storagePath, mimeType: f.mimeType, sizeBytes: f.sizeBytes })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })
}
```

- [ ] **Step 2: Create `src/modules/generate/service.ts`** — create flow: validate → sanitize → applyDefaults → createRecord(submitting) → createTask(queued, recordId) → return. List/get use repos. Retry creates new task. Cancel cancels task. Delete soft-deletes record.

The service does NOT call bailian — that's the worker's job. It only enqueues a `tasks` row of type `generate.<category>` (e.g. `generate.video`) with `recordId` link, domain `generate`, input `{ model, category, subCategory, params }`. Throw `ValidationError` on invalid params, `NotFoundError` on unknown model/record.

- [ ] **Step 3: Create `src/modules/generate/routes.ts`** — factory route with `{ isAuth: true }`

```
POST   /api/generate           { model, category, subCategory, inputParams } → { record, taskId }
GET    /api/records            ?category=&limit= → { items, total }
GET    /api/records/:id        → { record, files }
POST   /api/records/:id/retry  → { record, taskId }
POST   /api/records/:id/cancel → { ok }
DELETE /api/records/:id        → { ok }
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(api): generate module (create task + record CRUD)"
```

---

## Task 5: analysis module (project + step run)

**Files:**
- Create: `src/modules/analysis/service.ts`, `src/modules/analysis/routes.ts`

- [ ] **Step 1: Create service** — createProject(videoUrl), listProjects, getProject(with steps), runStep(projectId, step) which creates a task type `analysis.<step>` (asr/script) domain analysis linked projectId, getStep.

- [ ] **Step 2: Create routes** — factory, `{ isAuth: true }`:
```
POST   /api/analysis/projects              { videoUrl } → { project }
GET    /api/analysis/projects              → { items }
GET    /api/analysis/projects/:id          → { project, steps }
POST   /api/analysis/projects/:id/steps/:step/run → { step, taskId }
GET    /api/analysis/projects/:id/steps/:step     → { step }
```
Throw NotFoundError on unknown project, ForbiddenError if project.userId !== currentUser.id.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(api): analysis module (project + step run)"
```

---

## Task 6: transfer + upload + health modules

**Files:**
- Create: `src/modules/transfer/{service,routes}.ts`, `src/modules/upload/{service,routes}.ts`, `src/modules/health/routes.ts`

- [ ] **Step 1: transfer** — session CRUD (create/list/get), throw on cross-user access. WS signaling endpoint is a stub for now (returns 501 Not Implemented) — full WebRTC in Phase 7.

- [ ] **Step 2: upload** — multipart file upload via `AssetStorage.put('uploads', ...)`, validate type (image/video) + size limits, insert `uploaded_files` row, return `{ url, storagePath }`. delete removes file.

- [ ] **Step 3: health** — `/api/health/live` → 200 `{ ok: true }`; `/api/health/ready` → checks DB ping; `/api/health/db` → raw DB query.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(api): transfer + upload + health modules"
```

---

## Task 7: index.ts assembly + Eden App export + registry self-check test + route tests

**Files:**
- Create: `src/index.ts`
- Create: `tests/catalog.test.ts`, `tests/generate.test.ts`, `tests/analysis.test.ts`, `tests/health.test.ts`, `tests/registry.test.ts`

- [ ] **Step 1: Create `src/index.ts`** — assemble all route factories with ServerConfig, apply global plugins (errorHandler, cors, openapi, auth), `.listen(config.port)`, `export type App = typeof app`.

```ts
import { Elysia } from 'elysia'
import { cors } from '@elysia/cors'
import { openapi } from '@elysia/openapi'
import { loadServerConfig } from './config'
import { errorHandlerPlugin } from './lib/app-errors'
import { createAuthRoutes } from './modules/auth/routes'
import { createCatalogRoutes } from './modules/catalog/routes'
import { createGenerateRoutes } from './modules/generate/routes'
import { createAnalysisRoutes } from './modules/analysis/routes'
import { createTransferRoutes } from './modules/transfer/routes'
import { createUploadRoutes } from './modules/upload/routes'
import { createHealthRoutes } from './modules/health/routes'

const config = loadServerConfig()

const app = new Elysia()
  .use(errorHandlerPlugin)
  .use(cors({ credentials: true, origin: config.corsOrigin }))
  .use(openapi({ documentation: { info: { title: 'sequence API', version: '0.1.0' } } }))
  .use(createAuthRoutes(config.app.jwtSecret))
  .use(createCatalogRoutes())
  .use(createGenerateRoutes(config.app.jwtSecret))
  .use(createAnalysisRoutes(config.app.jwtSecret))
  .use(createTransferRoutes(config.app.jwtSecret))
  .use(createUploadRoutes(config.app.jwtSecret))
  .use(createHealthRoutes())
  .listen(config.port)

console.log(`🦊 sequence api at ${app.server?.hostname}:${app.server?.port}`)
export default app
export type App = typeof app
```

- [ ] **Step 2: Create `tests/registry.test.ts`** — assert ALL_MODELS non-empty + each passes `assertModelConfigConsistent` + every requestType represented.

- [ ] **Step 3: Write route tests** (catalog, generate, analysis, health) using test-factory + treaty against the full App. Mock `@seq/db` where needed via `bun:test` mock.module.

- [ ] **Step 4: Run full service test suite + typecheck**

```bash
cd services/api && bun --env-file=../../.env test && bun run typecheck
```

- [ ] **Step 5: Smoke test** — start api, curl `/api/health/live`, `/api/catalog`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(api): assemble app + Eden App export + registry self-check + route tests"
```

---

## Self-Review Notes

**Spec coverage:**
- §3.1 route groups (auth/catalog/generate/analysis/transfer/upload/health/openapi/sse) → Tasks 2,3,4,5,6,7 ✓ (SSE deferred — push via PG NOTIFY comes with worker Phase 7; api-side SSE listener can be a follow-up)
- §3.2 three-domain contracts → Tasks 4 (generate), 5 (analysis), 6 (transfer) ✓
- §3.3 improvements (AppError vs status-sniff, Eden, catalog returns ModelConfig[]) → Task 1 (AppError), Task 3 (catalog), Task 7 (Eden) ✓
- §3.4 error handling → Task 1 errorHandler ✓

**Type consistency:** `AppError` subclasses (Task 1) thrown consistently across services; `ServerConfig` (Task 1) passed to all factory routes; `AuthUserResponse` shape (Task 2) reused by me/login/register; repo functions re-exported from `@seq/db` barrel (Task 2 Step 3) used by all services.

**Scope note:** SSE event streaming (§3.1 `/sse`) requires the PG NOTIFY listener + worker integration — it's coupled to Phase 7 (worker pushes). I'll add a minimal `/api/sse` stub returning 501 in Task 6, and the full SSE listener as the first task of Phase 7 once the worker exists. This keeps Phase 6 self-contained and testable.

**Risk:** Task 3 (30-model registry port) is the largest single task. If it's too big for one pass, split into per-category sub-commits (video first, then image, then music). The `assertModelConfigConsistent` self-check in the registry barrel catches missing mappings early.
