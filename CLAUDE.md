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
bun run db:studio    # Drizzle Studio GUI
bun run db:test      # 仅 db 包测试（需 PG）

# 单包测试
bun test --cwd packages/db
bun test --cwd packages/db tests/tasks.repo.test.ts
```

> db 包测试需 Postgres 运行（`docker compose up -d db`），且需带 env：
> `cd packages/db && bun --env-file=../../.env test`

## Architecture

- **packages/**（非业务，专注单一职责）：`shared`(BASE) / `bailian-core`(纯契约+校验) / `bailian-client`(纯HTTP) / `task-engine`(纯任务生命周期) / `db`(运行时数据) / `storage`(运行时文件)
- **services/**：`api`(单体 Elysia :3000) / `worker`(任务轮询 :3001 health)
- **apps/**：`generate` / `analysis` / `transfer`（前端，模板手动创建）

**纯包纪律**：`bailian-core`/`bailian-client`/`task-engine` 只依赖 `shared`，绝不 import `db`/`storage`。声明 `*Adapter` 接口，由 services 注入实现。

## Key patterns

- **类型推导链**：Drizzle schema → InferSelectModel → serialize()(Date→ISO) → API 类型。单向，无重复。
- **JSONB 强类型**：列用 `$type<T>()` 附着领域类型（如 `inputParams: jsonb().$type<GenerationInputParams>()`）。
- **统一任务队列**：`tasks` 表是唯一异步执行层，`FOR UPDATE SKIP LOCKED` claim + 锁 + heartbeat + 孤儿清扫。生命周期决策走 `@seq/task-engine`。
- **DB 迁移脚本用 `bun --env-file=../../.env`**（直接执行文件），不是 `bun run`。`--env-file` 只对直接执行文件生效。

## DB tables

| 表 | 用途 |
|------|---------|
| `users` | 账户：username、email、password(bcrypt)、avatar、role |
| `tasks` | 统一异步任务队列 — type/domain/status、claim 锁、重试、errorJson |
| `generation_records` | 生成产物记录 — inputParams(JSONB typed)、outputResult、status、cost、dedupeKey |
| `generation_files` | 生成产物文件明细 |
| `analysis_projects` | 视频拆解分析项目 |
| `analysis_steps` | 分析一步步结果（step 枚举 asr/script） |
| `transfer_sessions` | P2P 传输会话 |
| `uploaded_files` | 上传文件跟踪 |

## 参考

- 架构设计：`docs/superpowers/specs/2026-06-26-sequence-v2-architecture-design.md`
- 实现计划：`docs/superpowers/plans/2026-06-26-scaffold-and-db-layer.md`
