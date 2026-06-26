# Phase 7: services/worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `services/worker` — the single poll-loop process that drives the unified `tasks` queue to completion. It claims tasks (`FOR UPDATE SKIP LOCKED`), dispatches by `task.type` to handlers, calls `@seq/bailian-client` for generation/analysis, extracts products via a `ProductExtractor` registry, downloads via `@seq/storage`, updates records, and applies retry/fail decisions from `@seq/task-engine`. Includes heartbeat, orphan sweep, graceful shutdown, and a health server.

**Architecture:** Worker is a thin orchestration layer. All lifecycle decisions (claim/complete/retry/fail, backoff, error classification) live in `@seq/task-engine` (pure, already built+tested). Worker implements the `*Adapter` interfaces and injects them. Handlers receive a `WorkerContext` (provider + storage + repos) — tests pass a fake context (`deps override`). The poll loop follows excuse's proven structure: segmented sleep for fast signal response, fatal-error detection (undefined table / ECONNREFUSED → stop with hint), graceful SIGINT/SIGTERM.

**Tech Stack:** Bun runtime, `@seq/task-engine`, `@seq/bailian-client`, `@seq/storage`, `@seq/db`, `@seq/shared`. `bun --env-file=../../.env run src/index.ts`.

**Reference spec:** `docs/superpowers/specs/2026-06-26-sequence-v2-architecture-design.md` (§4 Worker 设计).
**Reference source:** `/Users/yxswy/Documents/excuse/apps/worker/src/` (main loop, poll-source, lifecycle structure) — port structure, not the canvas/credit logic.

**Scope:** Phase 7 = worker only. It consumes the `tasks` table that api (Phase 6) populates. Frontend (Phase 8) is user-manual.

**Realtime note:** Task status changes notify the user via the api's SSE listener. That SSE listener (api-side, PG LISTEN) is a small follow-up after the worker exists — it's not in this phase's scope. The worker itself only updates DB (and can `pgClient.notify()` as a hook, but the api listener is added separately).

---

## File Structure

### Worker skeleton + lifecycle
- `services/worker/package.json`, `tsconfig.json`
- `src/index.ts` — `main()` entry (no top-level side effects)
- `src/config.ts` — `WorkerConfig` + `loadWorkerConfig()`
- `src/context.ts` — `WorkerContext` (bailian config, storage, repos) + `createWorkerContext()`
- `src/adapters.ts` — implements task-engine adapters backed by `@seq/db` repos + `notify` (console/SSE hook)
- `src/lifecycle.ts` — health server (:3001) + graceful shutdown + orphan sweep scheduler

### Poll + dispatch
- `src/poll-source.ts` — `createTaskPollSource(ctx, refs)`: claim → heartbeat → handle → complete/retry
- `src/registry.ts` — `TaskHandlerRegistry` registration of all task types
- `src/handlers/generate.ts` — `generate.video` / `generate.image` / `generate.audio` handlers
- `src/handlers/analysis.ts` — `analysis.asr` / `analysis.script` handlers
- `src/product-extractor.ts` — `ProductExtractor` registry (video/image/audio URL extraction)

### Tests
- `tests/handlers.test.ts` — handlers with fake ctx (deps override)
- `tests/poll-source.test.ts` — claim→handle→complete flow with fake adapters
- `tests/product-extractor.test.ts` — URL extraction per ProviderResult type

---

## Task 1: worker skeleton + config + context + adapters + lifecycle

**Files:**
- Create: `services/worker/package.json`, `tsconfig.json`, `src/config.ts`, `src/context.ts`, `src/adapters.ts`, `src/lifecycle.ts`

- [ ] **Step 1: Create `services/worker/package.json`**

```json
{
  "name": "@seq/worker",
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
    "@seq/shared": "workspace:*",
    "@seq/db": "workspace:*",
    "@seq/storage": "workspace:*",
    "@seq/bailian-core": "workspace:*",
    "@seq/bailian-client": "workspace:*",
    "@seq/task-engine": "workspace:*"
  },
  "devDependencies": { "typescript": "^5.6.0" }
}
```

- [ ] **Step 2: Create `services/worker/tsconfig.json`**

```json
{
  "extends": ["../../tsconfig.base.json"],
  "compilerOptions": { "types": ["bun"] },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `src/config.ts`**

```ts
export interface WorkerConfig {
  pollIntervalMs: number
  claimTtlMs: number
  sweepIntervalMs: number
  healthPort: number
  /** worker 实例标识（多实例时区分锁归属） */
  workerId: string
  /** bailian client 配置 */
  bailian: { apiKey: string; baseUrl?: string }
  storageRoot: string
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const apiKey = env.BAILIAN_API_KEY
  if (!apiKey || apiKey === 'replace-with-real-key') {
    console.warn('[worker] ⚠ BAILIAN_API_KEY 未配置或仍为占位值 — 生成任务将失败')
  }
  return {
    pollIntervalMs: Number(env.WORKER_POLL_INTERVAL_MS ?? 5000),
    claimTtlMs: Number(env.WORKER_CLAIM_TTL_MS ?? 60000),
    sweepIntervalMs: Number(env.WORKER_SWEEP_INTERVAL_MS ?? 300000),
    healthPort: Number(env.WORKER_HEALTH_PORT ?? 3001),
    workerId: env.WORKER_ID ?? `w-${Math.random().toString(36).slice(2, 8)}`,
    bailian: { apiKey: apiKey ?? '', baseUrl: env.BAILIAN_BASE_URL },
    storageRoot: env.STORAGE_DIR ?? './storage',
  }
}
```

- [ ] **Step 4: Create `src/context.ts`** — the `WorkerContext` that handlers receive + tests override

```ts
import type { BailianClientConfig } from '@seq/bailian-client'
import type { AssetStorage } from '@seq/storage'
import type { WorkerConfig } from './config'

/** handler 注入的依赖 —— 测试时传 fake。 */
export interface WorkerContext {
  config: WorkerConfig
  bailian: BailianClientConfig
  storage: AssetStorage
}

export function createWorkerContext(config: WorkerConfig): WorkerContext {
  // AssetStorage 惰性创建避免 import 循环；这里用 dynamic require 等价
  const { AssetStorage } = require('@seq/storage') as typeof import('@seq/storage')
  return {
    config,
    bailian: { apiKey: config.bailian.apiKey, baseUrl: config.bailian.baseUrl },
    storage: new AssetStorage({ storageRoot: config.storageRoot, publicBasePath: '/generate/storage' }),
  }
}
```

> NOTE: `require()` in ESM — use `await import('@seq/storage')` instead in a real async context, OR import statically at top. Prefer static import (no cycle here). Use static import in the actual file.

- [ ] **Step 5: Create `src/adapters.ts`** — task-engine adapter implementations backed by `@seq/db`

```ts
import type { Task } from '@seq/db'
import {
  markSucceeded, markRetrying, markFailed, extendTaskLock,
  type TaskCompletionAdapter, type TaskFailureAdapter, type TaskHeartbeatAdapter,
} from '@seq/task-engine'
import { createLogger } from '@seq/shared'

const logger = createLogger('worker')

export const completionAdapter: TaskCompletionAdapter<Task> = {
  async markTaskSucceeded(id, output) {
    return markSucceeded(id, output ?? {})
  },
  async notifyTaskStatusChange(task) {
    // Phase 7 占位：console 日志。后续接 PG NOTIFY → api SSE listener
    logger.info({ taskId: task.id, status: task.status }, 'task status changed')
  },
}

export const failureAdapter: TaskFailureAdapter = {
  async markTaskRetrying(id, nextRunAt) {
    await markRetrying(id, nextRunAt)
  },
  async markTaskFailed(id, errorInfo, errorMessage) {
    // markFailed 签名要求 errorJson + errorMessage；errorInfo 已含 message，errorMessage 为兜底
    await markFailed(id, (errorInfo as Record<string, unknown>) ?? {}, errorMessage ?? errorInfo?.message ?? 'unknown error')
  },
}

export function makeHeartbeatAdapter(workerId: string, claimTtlMs: number): TaskHeartbeatAdapter<Task> {
  return {
    async extendTaskLock(id) {
      return extendTaskLock(id, workerId, claimTtlMs)
    },
  }
}
```

- [ ] **Step 6: Create `src/lifecycle.ts`** — health server + graceful shutdown + orphan sweep

```ts
import { Elysia } from 'elysia'
import { sweepOrphanTasksWithAdapter, type TaskSweepAdapter } from '@seq/task-engine'
import { sweepOrphanTasks } from '@seq/db'
import { createLogger } from '@seq/shared'
import type { WorkerConfig } from './config'

const logger = createLogger('worker:lifecycle')

export interface HealthState {
  workerId: string
  isPolling: boolean
  lastPollAt: Date | null
  lastPollError: string | null
}

export function createHealthState(workerId: string): HealthState {
  return { workerId, isPolling: false, lastPollAt: null, lastPollError: null }
}

/** health server (:3001) — /live 探活。 */
export function startHealthServer(port: number, state: HealthState): { server: unknown; stop: () => void } {
  const app = new Elysia()
    .get('/live', () => ({
      ok: true,
      workerId: state.workerId,
      isPolling: state.isPolling,
      lastPollAt: state.lastPollAt?.toISOString() ?? null,
      lastPollError: state.lastPollError,
    }))
    .listen(port)
  return { server: app.server, stop: () => app.stop() }
}

/** 定时清扫孤儿任务（锁过期）。返回 stop 函数。 */
export function startOrphanSweep(config: WorkerConfig): () => void {
  const sweepAdapter: TaskSweepAdapter = { sweepOrphanTasks: (mins) => sweepOrphanTasks(mins) }
  const timer = setInterval(async () => {
    try {
      const n = await sweepOrphanTasksWithAdapter({ adapter: sweepAdapter })
      if (n > 0) logger.info({ swept: n }, 'orphan tasks reset')
    } catch (e) {
      logger.warn({ err: e }, 'orphan sweep failed')
    }
  }, config.sweepIntervalMs)
  return () => clearInterval(timer)
}

/** 优雅退出：SIGINT/SIGTERM 设置 runningRef=false，等待当前 task。 */
export function setupGracefulShutdown(
  runningRef: { value: boolean },
  currentTaskPromiseRef: { value: Promise<unknown> | null },
) {
  const handler = async (sig: string) => {
    logger.info({ sig }, 'received signal, shutting down')
    runningRef.value = false
    // 等待当前 task（最长 30s）
    if (currentTaskPromiseRef.value) {
      try {
        await Promise.race([
          currentTaskPromiseRef.value,
          new Promise((resolve) => setTimeout(resolve, 30_000)),
        ])
      } catch {
        // ignore — exiting anyway
      }
    }
    process.exit(0)
  }
  process.on('SIGINT', () => handler('SIGINT'))
  process.on('SIGTERM', () => handler('SIGTERM'))
}
```

- [ ] **Step 7: Typecheck + commit**

```bash
cd services/worker && bun install && bun run typecheck
git add -A && git -c user.name="sequence" -c user.email="dev@sequence.local" commit -m "feat(worker): skeleton + config + context + adapters + lifecycle"
```

---

## Task 2: product-extractor + handlers + registry + poll-source + main loop

**Files:**
- Create: `src/product-extractor.ts`, `src/handlers/generate.ts`, `src/handlers/analysis.ts`, `src/registry.ts`, `src/poll-source.ts`, `src/index.ts`
- Test: `tests/product-extractor.test.ts`, `tests/handlers.test.ts`, `tests/poll-source.test.ts`

- [ ] **Step 1: Create `src/product-extractor.ts`** — typed URL extraction from ProviderResult/query output

```ts
import type { QueryTaskOutput } from '@seq/bailian-client'

export interface ExtractedFile {
  url: string
  kind: string
}

/**
 * 从百炼任务查询结果提取产物 URL。
 * - video: output.video_url
 * - image: output.results[].url（可能多个）
 * - audio: 同步模型的 output.audio.url（由 handler 在 ProviderResult 阶段处理，此处处理异步 query 结果）
 *
 * 异步任务（video/image-async）走 queryTask 返回的 QueryTaskOutput；
 * 同步任务（image/audio）的结果在 createTask 响应中，由 handler 直接解析。
 */
export function extractFromQueryOutput(category: string, output: QueryTaskOutput): ExtractedFile[] {
  if (category === 'video') {
    return output.video_url ? [{ url: output.video_url, kind: 'primary' }] : []
  }
  if (category === 'image') {
    const urls = (output.results ?? []).map((r) => r.url).filter((u): u is string => Boolean(u))
    return urls.map((url, i) => ({ url, kind: i === 0 ? 'primary' : 'extra' }))
  }
  // audio 同步模型不经 query；异步兜底空
  return []
}

/** 从同步 image 响应（choices[].message.content[].image）提取 URL。 */
export function extractFromSyncImage(choices: Array<{ message?: { content?: Array<{ image?: string }> } }>): ExtractedFile[] {
  const urls: string[] = []
  for (const c of choices) {
    for (const part of c.message?.content ?? []) {
      if (part.image) urls.push(part.image)
    }
  }
  return urls.map((url, i) => ({ url, kind: i === 0 ? 'primary' : 'extra' }))
}
```

- [ ] **Step 2: Create `src/handlers/generate.ts`**

generate handler 逻辑：
1. 从 `task.input` 取 `{ recordId, model, category, subCategory, params }`
2. 用 registry 的 `findModel` 拿 ModelConfig（注意：registry 在 services/api，worker 不能 import api —— **需把 registry 提取或 worker 自带 bailian-client 调用所需的最小信息**）
3. 调 `bailian-client.createTask(ctx.bailian, <modelConfig>, params)`
4. 若 modelConfig.async：该 task 不在本轮完成 —— 返回 `{ asyncTaskId, status: 'polling' }`，由 task-engine 的 retry/backoff 在下一轮 queryTask（用 `analysis.asr`/`generate.video` 的 fixedInterval）。**简化**：worker 在同一 handler 内用 `waitForCompletion` 同步等待（claimTtl 内），避免多轮编排复杂度。
5. 提取产物 URL → `ctx.storage.downloadFromUrl(recordId, url, ext)` → `addFile` 入库 → 更新 record status=succeeded
6. 同步模型（image/audio）：createTask 直接返回结果，提取并下载

**关键决策**：为避免 worker ↔ api 的 registry 循环依赖，handler 不 import api 的 registry。`task.input` 已含 `model`/`category`/`subCategory`/`params`，worker 用一个**精简的 worker-side model lookup**（只含 buildRequestBody 所需：endpoint/async/requestType/inputMapping）。最简方案：把 5 个种子模型的 ModelConfig 也 export 给 worker —— 即把 `services/api/src/modules/generate/registry` 提升为一个**共享的 services-level module** 或复制到 worker。

**YAGNI 选择**：worker 直接复用 `@seq/bailian-client.createTask`，它需要完整 `ModelConfig`。最干净的做法是**把 registry 提到 `packages/bailian-core` 之外但不进 api**：实际上 registry 是业务数据，应在 services 共享。鉴于 Phase 6 把它放在 `services/api`，worker 要用就需 import `@seq/api` 的子路径 —— 但 api 不是包依赖目标。

**最终决策（写进 plan）**：handler 用 `task.input` 里已存的 `params` + 一个 **worker-local 的最小 model 元数据表**（endpoint/async/requestType/inputMapping，从种子集复制，~5 个）。新增模型时 worker 表同步登记一行。这是有意的冗余（worker 不依赖 api 进程），符合「services 之间不互相 import」的边界。

```ts
// src/handlers/generate.ts（精简版：展示结构，handler 接 WorkerContext + task）
import type { Task } from '@seq/db'
import { createTask as bailianCreate, queryTask } from '@seq/bailian-client'
import type { WorkerContext } from '../context'
import { getWorkerModelConfig } from '../worker-models'
import { extractFromQueryOutput, extractFromSyncImage } from '../product-extractor'
import { updateStatus, addFile } from '@seq/db'
import { TaskInputError } from '@seq/task-engine'
import { createLogger } from '@seq/shared'

const logger = createLogger('worker:generate')

export async function handleGenerate(task: Task, ctx: WorkerContext): Promise<Record<string, unknown>> {
  const input = task.input as { recordId?: string; model?: string; category?: string; subCategory?: string; params?: Record<string, unknown> }
  if (!input.recordId || !input.model || !input.category || !input.params) {
    throw new TaskInputError(`generate task 缺少必要输入字段: ${JSON.stringify(Object.keys(input))}`)
  }
  const modelConfig = getWorkerModelConfig(input.category, input.subCategory ?? '', input.model)
  if (!modelConfig) throw new TaskInputError(`worker 未知模型: ${input.model}`)

  const params = input.params
  try {
    if (modelConfig.async) {
      // 异步：create → 拿 taskId → waitForCompletion（claimTtl 内同步等待，简化多轮编排）
      const create = await bailianCreate(ctx.bailian, modelConfig, params)
      // createTask 异步返回 task_id；用 waitForCompletion 同步等（实际 bailian-client 已有此函数）
      const { waitForCompletion } = await import('@seq/bailian-client')
      const result = await waitForCompletion(ctx.bailian, create.output.task_id, {
        intervalMs: 15_000,
        maxAttempts: 40,
      })
      const files = extractFromQueryOutput(input.category, result.output)
      for (const f of files) {
        const info = await ctx.storage.downloadFromUrl(input.recordId, f.url, 'mp4')
        await addFile({ recordId: input.recordId, kind: f.kind, sourceUrl: f.url, storagePath: info.storagePath, mimeType: info.mimeType ?? undefined, sizeBytes: info.sizeBytes ?? undefined })
      }
      await updateStatus(input.recordId, 'succeeded', { outputResult: result.output })
      return { taskId: create.output.task_id, fileCount: files.length }
    }

    // 同步（image/audio）：createTask 响应内含结果
    const res = await bailianCreate(ctx.bailian, modelConfig, params)
    // image 同步：choices[].message.content[].image；audio：output.audio.url
    const syncOut = res as unknown as { output?: { choices?: Array<{ message?: { content?: Array<{ image?: string }> } }>; audio?: { url?: string } } }
    let files = extractFromSyncImage(syncOut.output?.choices ?? [])
    if (input.category === 'audio' && syncOut.output?.audio?.url) {
      files = [{ url: syncOut.output.audio.url, kind: 'primary' }]
    }
    for (const f of files) {
      const info = await ctx.storage.downloadFromUrl(input.recordId, f.url, input.category === 'audio' ? 'mp3' : 'png')
      await addFile({ recordId: input.recordId, kind: f.kind, sourceUrl: f.url, storagePath: info.storagePath, mimeType: info.mimeType ?? undefined, sizeBytes: info.sizeBytes ?? undefined })
    }
    await updateStatus(input.recordId, 'succeeded', { outputResult: syncOut.output as Record<string, unknown> })
    return { fileCount: files.length }
  } catch (e) {
    await updateStatus(input.recordId, 'failed', { errorMessage: e instanceof Error ? e.message : String(e) })
    throw e // 让 task-engine 决定 retry/fail
  }
}
```

- [ ] **Step 3: Create `src/worker-models.ts`** — worker-local minimal model metadata (the intentional redundancy)

```ts
import type { ModelConfig } from '@seq/bailian-core'
// 复制 services/api registry 的 ModelConfig（worker 不依赖 api 进程）
// 新增模型时两处同步登记
import { wan27T2v } from './models/wan27-t2v'
import { wan27I2v } from './models/wan27-i2v'
import { wan27R2v } from './models/wan27-r2v'
import { qwenTextToImage } from './models/qwen-t2i'
import { funMusicV1 } from './models/fun-music'

const WORKER_MODELS: ModelConfig[] = [wan27T2v, wan27I2v, wan27R2v, qwenTextToImage, funMusicV1]

export function getWorkerModelConfig(category: string, subCategory: string, model: string): ModelConfig | undefined {
  return WORKER_MODELS.find((m) => m.category === category && m.subCategory === subCategory && m.model === model)
}
```

> The 5 model files under `src/models/` are **copies** of `services/api/src/modules/generate/registry/*` (same content). This duplication is intentional per the plan's worker↔api boundary decision. Create them by copying.

- [ ] **Step 4: Create `src/handlers/analysis.ts`** — analysis.asr / analysis.script

```ts
import type { Task } from '@seq/db'
import type { WorkerContext } from '../context'
import { upsertStep, findProjectById } from '@seq/db'
import { TaskInputError } from '@seq/task-engine'
import { createLogger } from '@seq/shared'

const logger = createLogger('worker:analysis')

/**
 * analysis.asr: 调百炼 Paraformer ASR（录音文件识别）转写 videoUrl 的音频。
 * analysis.script: 基于上一步 ASR 结果 + videoUrl 生成剧本（调 LLM）。
 *
 * Phase 7 实现：handler 结构 + ASR 占位（实际 ASR client 调用作为 follow-up，
 * 因需 ASR-specific 的百炼端点，与 generate 不同）。
 */
export async function handleAnalysis(task: Task, ctx: WorkerContext): Promise<Record<string, unknown>> {
  const input = task.input as { projectId?: string; step?: string; videoUrl?: string; stepRowId?: string }
  if (!input.projectId || !input.step) {
    throw new TaskInputError('analysis task 缺少 projectId/step')
  }
  const project = await findProjectById(input.projectId)
  if (!project) throw new TaskInputError(`project ${input.projectId} 不存在`)

  // TODO(follow-up): 接入 Paraformer ASR client (analysis.asr) 与 LLM 剧本生成 (analysis.script)
  // 当前占位：写入结构化结果，标记 step 成功
  logger.info({ projectId: input.projectId, step: input.step }, 'analysis step (stub)')
  const result = { step: input.step, videoUrl: input.videoUrl, status: 'stub-implemented', note: 'ASR/LLM client 接入为 follow-up' }
  await upsertStep(input.projectId, input.step as 'asr' | 'script', { status: 'succeeded', result })
  return result
}
```

- [ ] **Step 5: Create `src/registry.ts`** — register all handlers

```ts
import { createTaskHandlerRegistry, type TaskDefinition } from '@seq/task-engine'
import type { Task } from '@seq/db'
import type { WorkerContext } from './context'
import { handleGenerate } from './handlers/generate'
import { handleAnalysis } from './handlers/analysis'

const definitions: Array<TaskDefinition<Task, WorkerContext>> = [
  { type: 'generate.video', handler: handleGenerate },
  { type: 'generate.image', handler: handleGenerate },
  { type: 'generate.audio', handler: handleGenerate },
  { type: 'analysis.asr', handler: handleAnalysis },
  { type: 'analysis.script', handler: handleAnalysis },
]

export const registry = createTaskHandlerRegistry<Task, WorkerContext>(definitions)
```

- [ ] **Step 6: Create `src/poll-source.ts`** — claim → heartbeat → handle → complete/retry

```ts
import type { Task } from '@seq/db'
import {
  claimNextTaskWithAdapter, completeTaskWithAdapter, applyTaskFailureWithAdapter,
  extendTaskLockWithAdapter, type TaskClaimAdapter,
} from '@seq/task-engine'
import { claimNextTask } from '@seq/db'
import type { WorkerContext } from './context'
import { registry } from './registry'
import { completionAdapter, failureAdapter, makeHeartbeatAdapter } from './adapters'
import { createLogger } from '@seq/shared'

const logger = createLogger('worker:poll')

const claimAdapter: TaskClaimAdapter<Task> = {
  claimNextTask: (workerId, ttl) => claimNextTask(workerId, ttl),
}

export interface PollSourceRefs {
  currentTaskPromiseRef: { value: Promise<unknown> | null }
}

export function createTaskPollSource(ctx: WorkerContext, refs: PollSourceRefs) {
  const heartbeat = makeHeartbeatAdapter(ctx.config.workerId, ctx.config.claimTtlMs)

  return {
    async poll(): Promise<void> {
      const task = await claimNextTaskWithAdapter<Task>({ workerId: ctx.config.workerId, claimTtlMs: ctx.config.claimTtlMs, adapter: claimAdapter })
      if (!task) return

      const taskPromise = (async () => {
        // heartbeat 续锁（任务执行期间定时续）
        const hb = setInterval(() => heartbeat.extendTaskLock(task.id, ctx.config.workerId, ctx.config.claimTtlMs), Math.floor(ctx.config.claimTtlMs / 2))
        try {
          const output = await registry.handle(task, ctx)
          await completeTaskWithAdapter<Task>({ task, output, adapter: completionAdapter })
        } catch (e) {
          const result = await applyTaskFailureWithAdapter<Task>({ task, error: e, adapter: failureAdapter })
          logger.warn({ taskId: task.id, action: result.action }, 'task failed/retrying')
        } finally {
          clearInterval(hb)
        }
      })()
      refs.currentTaskPromiseRef.value = taskPromise
      await taskPromise
      refs.currentTaskPromiseRef.value = null
    },
  }
}
```

- [ ] **Step 7: Create `src/index.ts`** — main loop (segmented sleep, fatal-error detection, graceful)

```ts
import { createLogger, isPgTableNotFoundError } from './pg-helpers'
import { loadWorkerConfig } from './config'
import { createWorkerContext } from './context'
import { createHealthState, startHealthServer, startOrphanSweep, setupGracefulShutdown } from './lifecycle'
import { createTaskPollSource } from './poll-source'

const logger = createLogger('worker')

async function main() {
  const config = loadWorkerConfig()
  const ctx = createWorkerContext(config)

  const healthState = createHealthState(config.workerId)
  const healthServer = startHealthServer(config.healthPort, healthState)
  const stopSweep = startOrphanSweep(config)
  setupGracefulShutdown({ value: true } as { value: boolean }, { value: null } as { value: Promise<unknown> | null })

  const runningRef = { value: true }
  const currentTaskPromiseRef = { value: null as Promise<unknown> | null }
  setupGracefulShutdown(runningRef, currentTaskPromiseRef)

  const pollSource = createTaskPollSource(ctx, { currentTaskPromiseRef })

  logger.info({ workerId: config.workerId, pollIntervalMs: config.pollIntervalMs, healthPort: config.healthPort }, '🤖 Worker started')

  while (runningRef.value) {
    healthState.isPolling = true
    try {
      await pollSource.poll()
      healthState.lastPollAt = new Date()
      healthState.lastPollError = null
    } catch (error: unknown) {
      if (isPgTableNotFoundError(error)) {
        logger.error('❌ tasks 表不存在，请先运行迁移：bun run db:push')
        healthState.lastPollError = 'UNDEFINED_TABLE'
        break
      }
      const code = (error as NodeJS.ErrnoException)?.code
      if (code === 'ECONNREFUSED') {
        logger.error('❌ PostgreSQL 未启动（连接被拒绝）')
        healthState.lastPollError = 'ECONNREFUSED'
        break
      }
      healthState.lastPollError = error instanceof Error ? error.message : String(error)
      logger.error({ err: error }, 'worker poll error')
    }
    healthState.isPolling = false

    // 分段 sleep，快速响应退出信号
    const sleepMs = config.pollIntervalMs
    let remaining = sleepMs
    while (remaining > 0 && runningRef.value) {
      const step = Math.min(remaining, 1000)
      await Bun.sleep(step)
      remaining -= step
    }
  }

  stopSweep()
  ;(healthServer as { stop: () => void }).stop()
  logger.info('🤖 Worker stopped.')
}

main()
```

> NOTE: `setupGracefulShutdown` is called twice in the sketch — call once. And `isPgTableNotFoundError` needs a helper (`src/pg-helpers.ts`) checking `error.cause.code === '42P01'` (PostgreSQL undefined_table). Create that helper file.

- [ ] **Step 8: Create `src/pg-helpers.ts`**

```ts
import { createLogger as _cl } from '@seq/shared'
export { createLogger } from '@seq/shared'

/** 检测 PostgreSQL "undefined table" 错误（错误码 42P01）。 */
export function isPgTableNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as { code?: string }).code ?? (error.cause as { code?: string } | undefined)?.code
  return code === '42P01'
}
```

- [ ] **Step 9: Copy 5 model files to `src/models/`** (worker-local copies of api registry)

Copy `services/api/src/modules/generate/registry/{video-wan27-t2v,video-wan27-i2v,video-wan27-r2v,image-qwen-t2i,audio-fun-music}.ts` → `services/worker/src/models/{wan27-t2v,wan27-i2v,wan27-r2v,qwen-t2i,fun-music}.ts` (adjust import paths — they import only from `@seq/bailian-core`, no change needed except filename). Update `worker-models.ts` import paths to match.

- [ ] **Step 10: Typecheck + write tests + run**

Tests:
- `tests/product-extractor.test.ts`: extractFromQueryOutput for video/image/audio; extractFromSyncImage for image choices
- `tests/handlers.test.ts`: handleGenerate with fake ctx (mock bailian-client + storage); handleAnalysis stub
- `tests/poll-source.test.ts`: poll with fake claimAdapter returning a task → handler runs → completionAdapter called

```bash
cd services/worker && bun run typecheck && bun --env-file=../../.env test
```

- [ ] **Step 11: Smoke test** — start worker (with BAILIAN_API_KEY unset → warns), curl :3001/live, verify it polls without crashing (no tasks → idle).

- [ ] **Step 12: Commit**

```bash
git add -A && git -c user.name="sequence" -c user.email="dev@sequence.local" commit -m "feat(worker): poll loop + handlers (generate/analysis) + product-extractor + lifecycle"
```

---

## Self-Review Notes

**Spec coverage:**
- §4.1 worker structure → Tasks 1-2 ✓
- §4.2 main loop (segmented sleep, fatal detection, graceful) → Task 2 Step 7 ✓
- §4.3 single-task flow (claim→handle→complete/retry via task-engine adapters) → poll-source ✓
- §4.4 handler registration by type → registry ✓
- §4.5 ProductExtractor strategy → product-extractor ✓
- §4.6 vs-v1 improvements (claim/lock/sweep/retry vs memory Map) → all present ✓

**Scope decisions (documented):**
- **worker↔api boundary**: worker has its own copy of the 5 model configs (intentional redundancy — services don't import each other). When the full 35-model port happens (Phase 6 follow-up), worker models sync too. Alternatively, extract registry to a shared `services/shared-models` package later — but YAGNI for 5 models.
- **async task polling**: simplified to `waitForCompletion` inside the handler (synchronous wait within claimTtl) rather than multi-round task re-enqueueing. This avoids complex polling-state-machine in the tasks table for v1 of the worker. Multi-round (poll across poll-cycles) is a documented future optimization.
- **analysis ASR/LLM**: stubbed — the Paraformer ASR client and LLM script generation are bailian endpoints distinct from the generation models, warranting their own focused implementation. The handler structure + task flow is complete; only the provider call is a TODO stub.
- **SSE**: worker logs status changes (notifyTaskStatusChange → console). The api-side PG LISTEN → SSE listener is a small follow-up task, not in Phase 7 scope.

**Type consistency:** `Task` (from @seq/db) flows through adapters/handlers/poll-source consistently. `WorkerContext` interface defined in context.ts, used in handlers + tests. Adapter interfaces match task-engine's `TaskCompletionAdapter`/`TaskFailureAdapter`/`TaskHeartbeatAdapter` exactly. `markFailed` repo signature (errorJson + errorMessage) wrapped in failureAdapter.
