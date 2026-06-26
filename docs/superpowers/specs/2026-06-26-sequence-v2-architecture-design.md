# sequence — v2 架构设计

> uhyc 项目的第二代。在 uhyc v1（生成工坊单体）基础上重构为全功能平台：类型更严谨、测试更完备、细节更明确、功能更完善（每个模型每个参数均可调），并扩展视频拆解分析与 P2P 传输两个业务域。

- **状态**：已与用户确认（六节逐节通过）
- **日期**：2026-06-26
- **参考项目**：`/Users/yxswy/Documents/uhyc`（v1，重构对象）、`/Users/yxswy/Documents/excuse`（worker/纯包分层参照）

## 已确认的方向

| 决策 | 选择 |
|------|------|
| 定位 | 全功能平台，前端拆 3 项目（生成工坊 / 视频拆解分析成剧本 / P2P 传输），后端细分 |
| 包纪律 | packages 专注非业务逻辑（OSS、DB、类型契约等），业务逻辑在 services |
| bailian 拆分 | 三层：bailian-core（类型+校验+定价）/ bailian-client（HTTP 适配器）/ 模型定义放 services 业务模块 |
| 后端形态 | 单体（非微服务），进程分离（api + worker 独立容器，同镜像不同 entrypoint） |
| 测试 | 分层测试（纯包高覆盖 + service 用 test-factory/mock DB + worker 用 deps override） |
| 连续性 | 全新项目，全新 schema，在 `/Users/yxswy/Documents/sequence` 起步 |
| 包布局 | 方案 A：业务域包 + 共享纯包（参考 excuse 的纯包 vs 运行时包分层） |

---

## 第 1 节：架构总览 + 包契约

### 1.1 Monorepo 布局

```
sequence/
├── apps/                        # 前端（模板用户手动创建，本设计只定 API 契约）
│   ├── generate/                # 生成工坊 SPA
│   ├── analysis/                # 视频拆解分析成剧本 SPA
│   └── transfer/                # P2P 传输 SPA
├── services/
│   ├── api/                     # 单体 Elysia 后端（:3000）
│   └── worker/                  # 统一任务轮询进程（+ health :3001）
├── packages/                    # 非业务，专注单一职责
│   ├── shared/                  # BASE：跨领域类型 + logger + config 解析
│   ├── bailian-core/            # 纯：模型契约 + 校验 + 定价（前后端共享）
│   ├── bailian-client/          # 纯：HTTP 适配器 + InputMapping 请求体构建 + 错误翻译
│   ├── task-engine/             # 纯：统一任务生命周期（claim/retry/fail）经 adapter
│   ├── db/                      # 运行时：Drizzle schema + repositories
│   └── storage/                 # 运行时：本地/OSS 双层 AssetStorage
├── package.json                 # workspace + catalog（elysia 等锁版本）
├── turbo.json
├── compose.yaml                 # postgres:17
├── Dockerfile                   # 多阶段（builder → api/worker 同镜像不同 entrypoint）
└── tsconfig.base.json           # strict + noUncheckedIndexedAccess + verbatimModuleSyntax
```

### 1.2 依赖方向（黄金法则）

```
shared ◄──── 一切依赖它
bailian-core ◄── bailian-client, services
bailian-client ◄── services
task-engine ◄── services/worker
db ◄── services（运行时）
storage ◄── services（运行时）
services/api, services/worker ── 顶层，组装 adapter
```

**纯包纪律**：`bailian-core` / `bailian-client` / `task-engine` 只依赖 `shared` + 标准库。它们声明 `*Adapter` 接口和接收 adapter 的纯函数，**绝不 import `db` / `storage`**。`services/api` 和 `services/worker` 实现这些 adapter 并注入。这是「类型严谨+测试完备」的根基：纯包不需 mock DB 就能测。

### 1.3 包契约

| 包 | 职责 | 关键导出 | 依赖 |
|----|------|---------|------|
| `@seq/shared` | BASE 层：`createLogger`、`loadConfig`、跨领域类型（`TaskStatus`/`ProviderResult` 联合）、env 校验 | `createLogger`、`serialize()` | 无 |
| `@seq/bailian-core` | **模型契约 + 纯规则**。`ModelConfig`（含 `parameters[]` + `inputMapping` + `pricing` + `requestType`）、`InputMapping` 判别联合、`validate`/`sanitize`/`applyDefaults`、`calcPrice`。无 HTTP | `ModelConfig`、`validate`、`calcPrice` | shared |
| `@seq/bailian-client` | **纯 HTTP 适配器**。`createTask`/`queryTask`/`waitForCompletion` + `buildRequestBody`（按 `requestType` 塑形）+ `formatBailianError`。无业务知识，无 model-name 分支 | `createTask`、`buildRequestBody` | shared, bailian-core |
| `@seq/task-engine` | **纯任务生命周期**。`claimNextTaskWithAdapter`/`completeTaskWithAdapter`/`applyTaskFailureWithAdapter`/`classifyTaskError`/退避策略表 | `decideTaskFailureAction`、`TaskHandlerRegistry` | shared |
| `@seq/db` | **运行时数据层**。Drizzle schema + `repositories/*.repo.ts`（async 函数）+ `getDb()/setDb()` 单例（测试注入）+ `serialize<T>()` | `db`、`table`、repo 函数 | shared |
| `@seq/storage` | **运行时文件层**。`AssetStorage` 类（本地↔OSS 双层）+ `StoredObjectResult` | `AssetStorage` | shared |

**模型定义放哪**：30 个 `ModelConfig` 对象不进 `packages`，而是放在 `services/api/src/modules/generate/registry/` 作为业务数据。`/catalog` 接口直接返回它们。理由：模型定义是业务资产（哪个模型上线下、定价调多少都是业务决策），不是被多 app 共享的纯契约。前端通过 API 拿到，不需要直接 import。

### 1.4 与 v1 的关键改进对照

| v1 问题 | v2 方案 |
|--------|--------|
| `params: Record<string, unknown>` + 校验里 `value as any` | `ModelConfig.parameters[]` 强类型 + `validate` 返回 typed `ValidationResult` |
| service.ts 里 `'choices' in output` / `'audio' in output` 字符串判分支 | `ProviderResult` 判别联合（`type: 'text'\|'image'\|'video_task'\|'audio'\|'failed'`）+ `requestType` 声明式请求体 |
| 产物下载只实现 video，image/music 是 TODO | 每个领域注册 `ProductExtractor` 策略，worker 按类型分发 |
| worker 目录是空的 | 真正的 `services/worker`，统一轮询 generate 异步任务 + analysis 阶段 |
| creativity 模块耦合进主 service | analysis 成为独立业务域模块，前端一步步操作 |
| poller 在 memory Map 里，重启靠 recoverOnStartup 扫表 | 统一 `tasks` 队列表 + `FOR UPDATE SKIP LOCKED` claim + 锁 + heartbeat |

---

## 第 2 节：DB Schema 设计

全新 schema，借鉴 excuse 的「统一任务队列 + 产物记录分离」模式，收窄到 uhyc 三业务域。核心思想：**`tasks` 表是唯一异步执行层**，业务产物（生成结果、分析剧本、传输会话）各自独立表，通过外键关联 task。

### 2.1 表清单

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `users` | 账户 | username、email、password(bcrypt)、avatar、role、timestamps |
| `tasks` | **统一异步任务队列** | type、domain、status、lockedBy、lockedUntil、attempts、maxAttempts、nextRunAt、errorJson、input(JSONB)、output(JSONB) |
| `generation_records` | 生成产物记录（generate 域） | userId FK、model、category、subCategory、inputParams(JSONB typed)、outputResult(JSONB)、status、cost、dedupeKey |
| `generation_files` | 生成产物文件明细 | recordId FK、kind、sourceUrl、storagePath、mimeType、sizeBytes |
| `analysis_projects` | 视频拆解分析项目（analysis 域） | userId FK、videoUrl、status、currentStep |
| `analysis_steps` | 分析的一步步结果（前端一步步操作） | projectId FK、step(枚举)、status、result(JSONB)、taskId FK→tasks |
| `transfer_sessions` | P2P 传输会话（transfer 域） | userId FK、status、createdAt |
| `uploaded_files` | 上传文件跟踪 | userId FK、purpose、storagePath、mimeType、sizeBytes |

### 2.2 统一任务队列表（核心）

这是 v2 相比 v1 最大的架构升级。v1 的 poller 把任务状态存在 `generation_tasks` 里 + 内存 Map，重启靠扫表。v2 用独立的 `tasks` 表做执行层，业务表只存产物。

```sql
tasks:
  id              uuid PK
  type            varchar(60)    -- 'generate.video' | 'generate.image' | 'analysis.asr'
                                -- | 'analysis.script' | 'transfer.cleanup' ...
  domain          varchar(20)    -- 'generate' | 'analysis' | 'transfer'
  status          enum           -- queued | running | retrying | succeeded | failed | cancelled
  priority        integer        -- 数字越小越早 claim
  input           jsonb          -- task-engine 读取的输入（含 recordId/projectId 关联）
  output          jsonb          -- 执行结果
  -- claim 锁
  lockedBy        varchar(60)    -- workerId
  lockedUntil     timestamp      -- 锁过期时间
  -- 重试
  attempts        integer        -- 当前重试次数
  maxAttempts     integer        -- 上限
  nextRunAt       timestamp      -- 重试的延迟执行时间
  -- 错误
  errorJson       jsonb          -- TaskErrorInfo { category, retriable, code, message }
  -- 关联
  recordId        uuid           -- → generation_records.id（可空，generate 域）
  projectId       uuid           -- → analysis_projects.id（可空，analysis 域）
  createdAt / updatedAt
```

**状态机**（照搬 excuse 验证过的）：
```
queued → running → succeeded
                 ↘ failed
running → retrying → queued（nextRunAt 延迟）
```
- Worker 经 `FOR UPDATE SKIP LOCKED` claim，设 `lockedBy`/`lockedUntil`，heartbeat 续期
- 清扫锁过期 >5 分钟的孤儿任务
- 所有生命周期决策走 `@seq/task-engine`（分类错误 → retry vs fail → 算 backoff）

### 2.3 与 v1 的关键区别

| 维度 | v1 | v2 |
|------|----|----|
| 任务存储 | `generation_tasks` 一表兼执行+产物 | `tasks`(执行) + `generation_records`(产物) 分离 |
| 锁机制 | 无，内存 Map | `lockedBy`/`lockedUntil` + heartbeat + 孤儿清扫 |
| 重试 | 无，失败即终态 | `attempts`/`maxAttempts`/`nextRunAt` + task-engine 退避策略 |
| 参数类型 | `params jsonb` 无类型 | `inputParams jsonb` 用 `$type<GenerationInputParams>()` 附着领域类型 |
| 多业务域 | creativity 硬塞进 generation 表 | analysis 有独立 `analysis_projects` + `analysis_steps` |

### 2.4 类型推导链（照搬 excuse）

Drizzle schema → `InferSelectModel` → `serialize()`（Date→ISO）→ API 类型。单向流动，无重复定义。JSONB 列用 `$type<T>()` 把领域类型附着上去（如 `inputParams: jsonb().$type<GenerationInputParams>()`），DB 读出来的就是强类型。

### 2.5 analysis 步骤枚举

`analysis_steps.step` 枚举当前定为：
- `asr`：语音转文字（Paraformer 录音文件识别）
- `script`：基于 ASR 结果生成剧本

> 该枚举是可扩展点。后续如需更多拆解分析阶段（如镜头切分、角色识别），在枚举 + worker handler 注册表 + 前端步骤 UI 三处同步新增即可，不动核心架构。

---

## 第 3 节：API 契约设计

所有路由挂在 `/api` 下，于 `services/api/src/index.ts` 挂载。采用 **factory 路由 + ServerConfig 注入**（照搬 excuse，便于测试）。前端经 **Eden treaty** 端到端类型安全（`export type App = typeof app`），绝不手写 fetch。

### 3.1 路由总览

| 路由组 | 模块 | 说明 |
|--------|------|------|
| `/api/auth/*` | auth | register、login、me、logout（JWT via `@elysia/jwt`，bcrypt via `Bun.password`，httpOnly cookie） |
| `/api/catalog` | catalog | 列出所有生成模型（返回 `ModelConfig[]`，驱动前端表单） |
| `/api/generate/*` | generate | 提交任务、查记录、列表、重试、取消 |
| `/api/analysis/*` | analysis | 项目 CRUD、单步执行、查步骤结果 |
| `/api/transfer/*` | transfer | 会话创建、WebRTC 信令 |
| `/api/upload` | upload | multipart 文件上传 + delete |
| `/api/health` | health | `/live`、`/ready`、`/db` |
| `/openapi` | docs | OpenAPI 文档（Scalar UI；生产门禁关闭） |
| `/sse` | events | SSE 事件流（任务状态变更推送） |

### 3.2 三业务域核心契约

**generate（生成工坊）**
```
POST   /api/generate                 { model, inputParams } → { record, taskId }
                                      校验 → 建 record(submitting) → 建 task(queued) → 返回
GET    /api/records                  ?category=&status=&limit= → { items, total }
GET    /api/records/:id              → { record, files }
POST   /api/records/:id/retry        → { record, taskId }（幂等 key 去重）
POST   /api/records/:id/cancel       → { ok }
DELETE /api/records/:id              软删（deletedAt）
```

**analysis（视频拆解分析成剧本）— 一步步操作**
```
POST   /api/analysis/projects        { videoUrl } → { project }（建项目，step=0）
GET    /api/analysis/projects        → { items }
GET    /api/analysis/projects/:id    → { project, steps: AnalysisStep[] }
POST   /api/analysis/projects/:id/steps/:step/run
                                      → { step, taskId }（执行单步，异步）
GET    /api/analysis/projects/:id/steps/:step
                                      → { step, result }（查单步结果）
```
- step 枚举：`asr`（语音转文字）→ `script`（生成剧本）→ ... 可扩展
- 每步独立 task，前端一步步触发、查结果，而非 v1 的整条工作流一次跑完

**transfer（P2P 传输）**
```
POST   /api/transfer/sessions        → { session }
WS     /api/transfer/signaling       WebRTC 信令（offer/answer/ICE）
```

### 3.3 与 v1 的关键改进

| v1 | v2 |
|----|----|
| `/api/generate/tasks` 混执行+查询 | 提交/记录/重试/取消分离，RESTful 清晰 |
| `isStatusReturn` 字符串嗅探判断错误 | 路由层 `throw AppError` 子类，全局 `onError` 统一序列化（照搬 excuse） |
| catalog 返回 `Record<cat, Record<subcat, ModelDefinition[]>>` | 返回 `ModelConfig[]`，含 `inputMapping`，前端能完整渲染每个参数 |
| 前端各自手写 fetch + `/api` proxy | Eden treaty 端到端类型，`unwrapEden<T>()` 提取 data 抛结构化错误 |

### 3.4 错误处理（统一）

`AppError` 子类（`BadRequestError`/`UnauthorizedError`/`NotFoundError`/`ValidationError`/`RateLimitError`/`ConflictError`/`InternalError`），由全局 `onError` 序列化为 `{ error, code, message }`。不在 handler 里手写 `set.status`。

---

## 第 4 节：Worker 设计

`services/worker` 是独立进程，单 poll 循环驱动统一 `tasks` 队列。这是 v1 空的 `services/worker` 目录的真正落地，完全借鉴 excuse 验证过的模式。

### 4.1 架构

```
services/worker/src/
├── index.ts              # 主循环：import 无副作用，所有副作用收敛到 main()
├── config.ts             # loadConfig()（pollInterval/claimTtl/sweepInterval/healthPort）
├── context.ts            # createWorkerContext()：组装 provider/storage/repo 单例
├── poll-source.ts        # PollSource 接口 { poll(): Promise<void> }
├── poll-sources.ts       # createTaskPollSource()：claim → handle → complete/retry
├── task-handler.ts       # TaskHandlerRegistry 注册所有 task type 的 handler
├── task-ownership.ts     # heartbeat 续锁 + 孤儿检测
├── worker-lifecycle.ts   # 健康服务器(:3001) + 优雅退出(SIGINT/SIGTERM)
├── handlers/             # 按 domain 分组的 handler
│   ├── generate.ts       # generate.video / generate.image / generate.music
│   ├── analysis.ts       # analysis.asr / analysis.script ...
│   └── transfer.ts       # transfer.cleanup
├── product-extractor.ts  # 产物解析策略注册表（按 category 提取 url/下载）
└── services/             # worker 注入的 adapter 实现（claim/sweep/notify）
```

### 4.2 主循环（照搬 excuse 的健壮结构）

```
main():
  ctx = createWorkerContext(config)
  lifecycle = setupLifecycle(config)         # provider observer + health server + 信号处理
  runningRef = { value: true }
  lifecycle.setupGracefulShutdown(runningRef, currentTaskPromiseRef)
  stopSweep = lifecycle.startOrphanSweep()   # 定时清扫锁过期任务

  pollSources = [createTaskPollSource(ctx, ...)]

  while runningRef.value:
    try:
      for source in pollSources:
        if !runningRef.value: break
        await source.poll()
    catch error:
      if isUndefinedTable / ECONNREFUSED:    # 致命，停 worker 提示迁移/起 DB
        runningRef.value = false; break
      log error
    分段 sleep（1000ms 步进，快速响应退出信号）
```

关键健壮性：**分段 sleep**（不是整段 sleep，能秒级响应 SIGINT）、**致命错误识别**（表不存在/DB 没起直接停并提示）、**优雅退出**（等待当前 task 最长 30s）。

### 4.3 单任务执行流程（核心）

```
createTaskPollSource.poll():
  task = await claimNextTaskWithAdapter({     # ← @seq/task-engine 纯函数
    workerId, claimTtlMs, adapter: ctx.claimAdapter
  })
  if !task: return

  try:
    handler = registry.get(task.type)         # 按 type 分发
    output = await handler(task, ctx)         # deps override 便于测试
    await completeTaskWithAdapter({           # ← @seq/task-engine
      task, output, adapter: ctx.completionAdapter
    })
    await ctx.notifyStatusChange(task)         # worker → DB → PG NOTIFY（见下）
  catch error:
    result = await applyTaskFailureWithAdapter({  # ← @seq/task-engine 决策
      task, error, adapter: ctx.failureAdapter
    })
    if result.action === 'fail':
      await ctx.notifyStatusChange(task)       # 同样走 PG NOTIFY
```

**实时推送通道（明确分工，借鉴 excuse 验证过的模式）**：
- **任务状态变更（generate/analysis）→ SSE**：worker 更新 DB 后 `pgClient.notify('task_status')`，api 进程的 `startSSEListener()` 经 PG LISTEN 收到，dispatcher 把载荷映射为 SSE 事件推送到内存中的 SSE 连接，client 收到。这是跨进程（worker→api→client）的干净通道，api 不需要知道 worker 在做什么。
- **transfer 信令 → WS**：WebRTC offer/answer/ICE 需要双向，用专门的 WS 端点（`/api/transfer/signaling`）。

`notifyStatusChange` 在 worker 侧只是 `pgClient.notify()`（PG 原生 LISTEN/NOTIFY，无额外依赖）。task-engine 的 retry/fail 决策、退避策略、错误分类都有独立单测。

### 4.4 Handler 注册（按 task.type 分发）

```ts
// task-handler.ts
registry.registerMany([
  // generate 域
  { type: 'generate.video',  handler: handleGenerateVideo },
  { type: 'generate.image',  handler: handleGenerateImage },
  { type: 'generate.music',  handler: handleGenerateMusic },
  // analysis 域
  { type: 'analysis.asr',    handler: handleAnalysisAsr },
  { type: 'analysis.script', handler: handleAnalysisScript },
  // transfer 域
  { type: 'transfer.cleanup', handler: handleTransferCleanup },
])
```

每个 handler 签名：`(task: Task, ctx: WorkerContext) => Promise<TaskOutput>`。`WorkerContext` 注入 provider（bailian-client）、storage、repo —— **测试时传 fake ctx** 即可，无需 mock DB。

### 4.5 generate handler 的统一产物处理

v1 的痛点：service.ts 里 `'choices' in output` / `'audio' in output` 字符串判分支，image/music 下载是 TODO。v2 用 **`ProductExtractor` 策略注册表**统一处理：

```ts
// product-extractor.ts
interface ProductExtractor {
  match(category: string): boolean
  extract(recordId: string, output: ProviderResult): Promise<ExtractedFile[]>
}

registry.registerMany([
  videoExtractor,    // 从 ProviderResult.type='video_task' 拿 video_url
  imageExtractor,    // 从 type='image' 拿 urls[]
  audioExtractor,    // 从 type='audio' 拿 url
])
```

handler 流程：调 `bailian-client.createTask` → 若异步则该 task 留在队列轮询 → 完成后经 `ProductExtractor` 提取 url → `AssetStorage` 下载入库 → `completeTask`。

### 4.6 与 v1 的对比

| v1 | v2 |
|----|----|
| poller 在内存 Map，重启扫表 | `tasks` 表 + `FOR UPDATE SKIP LOCKED` claim + 锁 + 孤儿清扫 |
| 失败即终态，无重试 | task-engine 退避策略（固定间隔/指数），声明式 policy 表 |
| sync/async 字符串判分支 | `ProviderResult` 判别联合 + `ProductExtractor` 策略 |
| image/music 产物 TODO | 统一 extractor 注册，新增领域零改 handler |
| 无优雅退出 | SIGINT/SIGTERM 等待当前任务 + 分段 sleep |

---

## 第 5 节：测试矩阵

分层测试策略：纯包高覆盖（无 IO，直接测）、service 层用 test-factory + mock DB、worker 用 deps override。**追求关键分支覆盖，不追求行覆盖率 100%**。

### 5.1 各层测试方法（照搬 excuse 验证过的法）

| 层 | 工具 | 方法 | 无需 mock |
|----|------|------|----------|
| **纯包**（bailian-core / bailian-client / task-engine） | `bun:test` | 直接调纯函数，传 fake adapter / 内存 fixture | ✓ 不碰 DB/IO |
| **service / 路由**（services/api） | `bun:test` + `treaty<App>()` | `test-factory` 造数据 + `mock.module` mock `@seq/db` + 针对最小 Elysia 实例 treaty 测试 | mock DB |
| **worker** | `bun:test` | handler 接受 `deps` override（`WorkerContext` 接口），传 fake ctx | fake ctx |
| **db** | `bun:test` | 事务 scope 的 Drizzle 实例 + `setDb()` 注入 | 真实 PG |

关键约定：**server 套件用 `--isolate`**（`mock.module` 多文件同跑会污染）。跑单文件 `bun test path/test.ts`，跑多个 mock.module 文件 `bun test --isolate a.test.ts b.test.ts`。

### 5.2 纯包测试覆盖（高覆盖区）

**`@seq/bailian-core`**
- `validate`：必填/类型/maxLength/min/max/select 合法值/select 非法值/boolean → 每条分支
- `sanitize`：剥离未声明 key、保留声明 key
- `applyDefaults`：填默认、保留用户值、跳过空串
- `calcPrice`：tier 匹配、tier 不匹配回落默认、quantityKey 取值、数量乘算
- `ModelConfig` 自检：每个 required 参数都在 inputMapping 有映射（数据完整性）

**`@seq/bailian-client`**
- `buildRequestBody`：每个 `requestType`（video-t2v / video-media / image / audio）的请求体形状
- `applyMappings`：prompt / parameter / mediaField / media / ignored 五种 target
- `createTask` / `queryTask`：成功解析、失败经 `formatBailianError` 翻译（用 `fetch` mock）

**`@seq/task-engine`**（worker 正确性的根基，重点覆盖）
- `classifyTaskError`：每种错误类别（provider_error / timeout / validation / system）+ 可重试判定
- `decideTaskFailureAction`：retry（attempts < max）/ fail 边界
- `computeRetryDelay`：固定间隔型 / 指数退避型 / 默认
- `getTaskPriority`：type override / domain fallback / default
- `TaskHandlerRegistry`：注册、未注册抛 `TaskNotImplementedError`
- `applyTaskFailureWithAdapter`：retry 路径调 `markTaskRetrying`、fail 路径调 `markTaskFailed`

### 5.3 service / 路由测试（关键分支）

`test-factory` 提供：`makeAccount`、`makeRecord`、`makeFailedRecord`、`makeTestConfig`、`signTestToken`、`extractEdenError`。

**覆盖的关键分支**：
- **generate**：提交成功（建 record + task）、校验失败（422）、未知模型（422）、查记录（含 files）、重试幂等、取消非 own record（403）、软删
- **analysis**：建项目、单步 run（建 task）、查步骤结果、跨用户访问（403）
- **auth**：register、login（密码校验）、me（鉴权）、logout、未授权访问（401）
- **catalog**：返回全部模型、结构完整
- **upload**：multipart 上传、delete
- **health**：/live、/db

### 5.4 worker 测试

handler 接受 `deps` override，传 fake ctx（fake provider 返回固定 `ProviderResult`、fake storage 记录调用）：
- **generate.video handler**：异步任务提交成功、provider 失败触发 retry/fail 决策、产物提取下载
- **ProductExtractor**：每个 category 的 url 提取
- **claim 失败重试**：lock lost → 重新排队

### 5.5 与 v1 的对比

| v1 | v2 |
|----|----|
| 13 个测试文件，集中在 bailian 校验 + auth | 分层覆盖，service/worker 关键分支都有测 |
| service 层（create/sync/poller/download）零测试 | test-factory + mock DB 覆盖 |
| 无 worker 测试 | deps override 注入 fake ctx |

---

## 第 6 节：Docker 编排 + 启动流程

### 6.1 容器拓扑

单体后端但**进程分离**：`api` 和 `worker` 用同一镜像、不同 entrypoint，独立容器。DB 单独容器。

```
┌─────────────────────────────────────────────┐
│  docker compose                              │
│                                              │
│  ┌──────────┐   ┌──────────────────────────┐│
│  │ postgres │   │ image: sequence:latest   ││
│  │  :5432   │   │  (多阶段构建产物)          ││
│  └────┬─────┘   │                           ││
│       │         │  ┌─────────┐ ┌─────────┐ ││
│       └─────────┼─►│  api    │ │ worker  │ ││
│                 │  │ :3000   │ │ :3001   │ ││
│                 │  │ Elysia  │ │ health  │ ││
│                 │  └─────────┘ └─────────┘ ││
│                 └──────────────────────────┘│
└─────────────────────────────────────────────┘
   前端 3 个 SPA 独立构建，生产由 api 静态 serve（按需）
```

### 6.2 compose.yaml

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: sequence
      POSTGRES_PASSWORD: sequence_dev
      POSTGRES_DB: sequence
    ports: ["5432:5432"]
    volumes: [sequence_pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sequence -d sequence"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: .
    command: ["bun", "run", "services/api/src/index.ts"]
    env_file: .env
    ports: ["3000:3000"]
    depends_on:
      db: { condition: service_healthy }
    volumes:
      - ./storage:/app/storage      # 本地存储挂载（OSS 未配时）

  worker:
    build: .
    command: ["bun", "run", "services/worker/src/index.ts"]
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
    volumes:
      - ./storage:/app/storage      # 与 api 共享本地存储

volumes:
  sequence_pgdata:
```

关键点：
- **api/worker 共享 `./storage` 卷**（本地存储模式下，worker 下载产物 api 能读）
- **worker 不暴露端口给外部**，只 health :3001（内部探活）
- `depends_on: service_healthy` 确保 DB 就绪才起 api/worker

### 6.3 Dockerfile（多阶段）

```dockerfile
# ── builder ──
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/*/package.json ./packages/*/
COPY services/*/package.json ./services/*/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build          # turbo build（生成前端 dist + tsc 校验）

# ── runtime（api + worker 共用）──
FROM oven/bun:1-slim AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services ./services
COPY --from=builder /app/apps/*/dist ./apps-dist/   # 前端产物
EXPOSE 3000
```

api/worker 同镜像，靠 compose 的 `command` 区分 entrypoint。

### 6.4 环境变量

```bash
# .env.example
DATABASE_URL=postgres://sequence:sequence_dev@localhost:5432/sequence
JWT_SECRET=dev-secret-change-me
BAILIAN_API_KEY=replace-with-real-key
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1

# Storage（任一）
STORAGE_DIR=./storage                    # 本地
OSS_REGION=oss-cn-hangzhou               # OSS（配齐则启用）
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

### 6.5 启动 / 迁移流程

```bash
docker compose up -d db              # 先起 DB
bun run --cwd packages/db db:push    # 推 schema（开发）/ db:migrate（生产）
bun run dev                          # turbo dev（api + worker + 前端）
docker compose up -d                 # 生产全栈
```

DB 迁移脚本用 `bun --env-file ../../.env`（注意：`--env-file` 只对直接执行文件生效，不对 `bun run` 子命令生效）。

### 6.6 启动时校验（照搬 v1 但更严）

`services/api` 启动时 `validateEnv()` 检查 `JWT_SECRET`/`BAILIAN_API_KEY`：
- 未设 → 启动失败退出
- 生产用默认值 → 启动失败退出
- 开发用默认值 → 警告但继续

---

## 实现路线图

按依赖顺序分阶段，每个阶段可独立验证：

1. **脚手架**：monorepo 骨架（package.json/turbo.json/tsconfig/compose/Dockerfile/.env.example）+ 六个空包的 package.json
2. **shared + db**：`@seq/shared`（logger/config/serialize）+ `@seq/db`（Drizzle schema 全部表 + repositories + getDb/setDb）
3. **bailian-core + bailian-client**：类型契约 + 校验 + 定价 + HTTP 适配器 + buildRequestBody，配套纯包测试
4. **task-engine**：纯任务生命周期 + 退避/优先级策略表，配套测试
5. **storage**：AssetStorage 本地/OSS 双层
6. **services/api**：auth + catalog + generate + analysis + transfer + upload + health + 错误处理 + Eden App 导出，配套 test-factory + 路由测试
7. **services/worker**：主循环 + poll-source + handlers + product-extractor + 生命周期，配套 deps override 测试
8. **前端 3 个 SPA 骨架**（模板由用户手动创建，本设计仅约束 API 契约和 Eden treaty 接入方式）

> 前端模板由用户手动创建。本设计对前端的约束仅在：经 Eden treaty 接入 `App` 类型、`unwrapEden<T>()` 提取响应、SSE 事件订阅三处。具体 UI/设计系统不在本 spec 范围。
