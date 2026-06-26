import { type TaskErrorCategory, type TaskErrorInfo } from '@seq/shared'

// ---------------------------------------------------------------------------
// 任务类型与 handler 注册
// ---------------------------------------------------------------------------

export type TaskHandler<TTask, TContext, TOutput = Record<string, unknown> | undefined> = (
  task: TTask,
  context: TContext,
) => Promise<TOutput> | TOutput

export interface TaskDefinition<TTask, TContext, TOutput = Record<string, unknown> | undefined> {
  type: string
  handler: TaskHandler<TTask, TContext, TOutput>
}

export interface TaskErrorDecision {
  category: TaskErrorCategory
  retriable: boolean
  code?: string
  message: string
}

export type TaskFailureAction =
  | { action: 'retry'; decision: TaskErrorDecision; delayMs: number }
  | { action: 'fail'; decision: TaskErrorDecision }

export interface TaskRetryCandidate {
  type: string
  attempts: number
  maxAttempts: number
}

// ---------------------------------------------------------------------------
// 优先级 / 退避策略表（声明式，新增业务 type 只改表）
// ---------------------------------------------------------------------------

export interface TaskPriorityPolicy {
  /** Per-type 优先级覆盖（最高优先） */
  typeOverrides: Record<string, number>
  /** Per-domain 回退优先级 */
  domainFallbacks: Record<string, number>
  /** 默认优先级 */
  default: number
}

export interface TaskBackoffPolicy {
  /** Type → 固定轮询间隔（ms），用于异步轮询型 task */
  fixedInterval: Record<string, number>
  /** Type → 指数退避 base（ms），delay = base × 2^(attempts-1) */
  exponentialBase: Record<string, number>
  /** 其余 task 的默认延迟（ms） */
  default: number
}

export interface TaskPriorityInput {
  type: string
  domain: string
}

/** 当前默认优先级策略（数字越小越早 claim） */
export const DEFAULT_PRIORITY_POLICY: TaskPriorityPolicy = {
  typeOverrides: {
    'generate.video': 4,
    'analysis.asr': 4,
  },
  domainFallbacks: {
    generate: 5,
    analysis: 5,
    transfer: 6,
  },
  default: 5,
}

/** 当前默认退避策略 */
export const DEFAULT_BACKOFF_POLICY: TaskBackoffPolicy = {
  fixedInterval: {
    'generate.video': 5_000,
    'analysis.asr': 5_000,
  },
  exponentialBase: {},
  default: 30_000,
}

// ---------------------------------------------------------------------------
// 错误分类注册表 — 声明式，每个错误码的 category + retriable
// ---------------------------------------------------------------------------

const ERROR_CODE_REGISTRY: Record<string, { category: TaskErrorCategory; retriable: boolean }> = {
  ECONNREFUSED: { category: 'timeout', retriable: true },
  ETIMEDOUT: { category: 'timeout', retriable: true },
  TIMEOUT: { category: 'timeout', retriable: true },
  ECONNRESET: { category: 'provider_error', retriable: true },
  Throttling: { category: 'provider_error', retriable: true },
  InternalError: { category: 'provider_error', retriable: true },
  LOCK_LOST: { category: 'system', retriable: true },
}

// ---------------------------------------------------------------------------
// 自定义错误类型
// ---------------------------------------------------------------------------

export class TaskNotImplementedError extends Error {
  constructor(taskType: string) {
    super(`Task handler not implemented: ${taskType}`)
    this.name = 'TaskNotImplementedError'
  }
}

/** 任务输入非法 — 重试不会自愈，直接永久失败。 */
export class TaskInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskInputError'
  }
}

/** 任务锁丢失 — 系统级瞬态，应重新排队。 */
export class TaskLockLostError extends Error {
  code: string
  constructor(taskId: string, workerId: string) {
    super(`Lock ownership lost for task ${taskId} (worker ${workerId})`)
    this.name = 'TaskLockLostError'
    this.code = 'LOCK_LOST'
  }
}

// ---------------------------------------------------------------------------
// Adapter 接口 — 纯包不碰 IO，由 worker 注入实现
// ---------------------------------------------------------------------------

export interface TaskCompletionAdapter<TTask extends { id: string }, TOutput = Record<string, unknown> | undefined> {
  markTaskSucceeded: (id: string, output?: TOutput) => Promise<TTask | null> | TTask | null
  notifyTaskStatusChange: (task: TTask) => Promise<unknown> | unknown
}

export interface TaskClaimAdapter<TTask> {
  claimNextTask: (workerId: string, claimTtlMs: number) => Promise<TTask | null> | TTask | null
}

export interface TaskSweepAdapter {
  sweepOrphanTasks: (timeoutMinutes?: number) => Promise<number> | number
}

export interface TaskHeartbeatAdapter<TTask> {
  extendTaskLock: (id: string, workerId: string, claimTtlMs: number) => Promise<TTask | null> | TTask | null
}

export interface TaskCancelAdapter<TTask> {
  cancelTask: (id: string) => Promise<TTask | null> | TTask | null
}

export interface TaskFailureAdapter {
  markTaskRetrying: (id: string, nextRunAt: Date) => Promise<unknown> | unknown
  markTaskFailed: (id: string, errorInfo?: TaskErrorInfo, errorMessage?: string) => Promise<unknown> | unknown
}

export interface CompleteTaskWithAdapterInput<TTask extends { id: string }, TOutput = Record<string, unknown> | undefined> {
  task: TTask
  output?: TOutput
  adapter: TaskCompletionAdapter<TTask, TOutput>
}

export interface ClaimNextTaskWithAdapterInput<TTask> {
  workerId: string
  claimTtlMs: number
  adapter: TaskClaimAdapter<TTask>
}

export interface SweepOrphanTasksWithAdapterInput {
  timeoutMinutes?: number
  adapter: TaskSweepAdapter
}

export interface ExtendTaskLockWithAdapterInput<TTask> {
  taskId: string
  workerId: string
  claimTtlMs: number
  adapter: TaskHeartbeatAdapter<TTask>
}

export interface CancelTaskWithAdapterInput<TTask> {
  taskId: string
  adapter: TaskCancelAdapter<TTask>
}

export interface ApplyTaskFailureWithAdapterInput<TTask extends TaskRetryCandidate & { id: string }> {
  task: TTask
  error: unknown
  adapter: TaskFailureAdapter
  now?: () => number
}

export type ApplyTaskFailureWithAdapterResult =
  | { action: 'retry'; decision: TaskErrorDecision; delayMs: number; nextRunAt: Date }
  | { action: 'fail'; decision: TaskErrorDecision; errorInfo: TaskErrorInfo; errorMessage: string }

// ---------------------------------------------------------------------------
// Handler 注册表
// ---------------------------------------------------------------------------

export class TaskHandlerRegistry<TTask extends { type: string }, TContext, TOutput = Record<string, unknown> | undefined> {
  private readonly handlers = new Map<string, TaskHandler<TTask, TContext, TOutput>>()

  register(definition: TaskDefinition<TTask, TContext, TOutput>): this {
    this.handlers.set(definition.type, definition.handler)
    return this
  }

  registerMany(definitions: Array<TaskDefinition<TTask, TContext, TOutput>>): this {
    for (const definition of definitions) this.register(definition)
    return this
  }

  has(taskType: string): boolean {
    return this.handlers.has(taskType)
  }

  get(taskType: string): TaskHandler<TTask, TContext, TOutput> | undefined {
    return this.handlers.get(taskType)
  }

  listTypes(): string[] {
    return [...this.handlers.keys()]
  }

  async handle(task: TTask, context: TContext): Promise<TOutput> {
    const handler = this.get(task.type)
    if (!handler) throw new TaskNotImplementedError(task.type)
    return handler(task, context)
  }
}

export function createTaskHandlerRegistry<
  TTask extends { type: string },
  TContext,
  TOutput = Record<string, unknown> | undefined,
>(definitions: Array<TaskDefinition<TTask, TContext, TOutput>> = []): TaskHandlerRegistry<TTask, TContext, TOutput> {
  return new TaskHandlerRegistry<TTask, TContext, TOutput>().registerMany(definitions)
}

// ---------------------------------------------------------------------------
// 策略：优先级 / 退避
// ---------------------------------------------------------------------------

/** 统一任务优先级策略。数字越小越早被 claim。 */
export function getTaskPriority(
  input: TaskPriorityInput,
  policy: TaskPriorityPolicy = DEFAULT_PRIORITY_POLICY,
): number {
  if (input.type in policy.typeOverrides) return policy.typeOverrides[input.type]!
  if (input.domain in policy.domainFallbacks) return policy.domainFallbacks[input.domain]!
  return policy.default
}

/** 统一任务退避策略。 */
export function computeRetryDelay(
  taskType: string,
  attempts: number,
  policy: TaskBackoffPolicy = DEFAULT_BACKOFF_POLICY,
): number {
  if (taskType in policy.fixedInterval) return policy.fixedInterval[taskType]!
  if (taskType in policy.exponentialBase) {
    const base = policy.exponentialBase[taskType]!
    return base * 2 ** Math.min(attempts - 1, 3)
  }
  return policy.default
}

// ---------------------------------------------------------------------------
// 错误分类与重试决策
// ---------------------------------------------------------------------------

export function classifyTaskError(error: unknown): TaskErrorDecision {
  const message = error instanceof Error ? error.message : String(error)

  if (error instanceof TaskNotImplementedError) {
    return { category: 'validation', retriable: false, message }
  }
  if (error instanceof TaskInputError) {
    return { category: 'validation', retriable: false, message }
  }
  if (error instanceof TaskLockLostError) {
    return { category: 'system', retriable: true, code: 'LOCK_LOST', message }
  }
  if (!(error instanceof Error)) {
    return { category: 'system', retriable: false, message }
  }

  const code = extractErrorCode(error)
  const retriable = isRetriableTaskErrorCode(code)
  return {
    category: categorizeTaskErrorCode(code),
    retriable,
    ...(code ? { code } : {}),
    message,
  }
}

export function shouldRetryTask(error: unknown, attempts: number, maxAttempts: number): boolean {
  return classifyTaskError(error).retriable && attempts < maxAttempts
}

export function decideTaskFailureAction(task: TaskRetryCandidate, error: unknown): TaskFailureAction {
  const decision = classifyTaskError(error)
  if (decision.retriable && task.attempts < task.maxAttempts) {
    return { action: 'retry', decision, delayMs: computeRetryDelay(task.type, task.attempts) }
  }
  return { action: 'fail', decision }
}

export function extractErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined
  const ownCode = (error as { code?: string }).code
  if (ownCode) return ownCode
  const cause = error.cause as { code?: string } | undefined
  return cause?.code
}

function isRetriableTaskErrorCode(code: string | undefined): boolean {
  return code != null && ERROR_CODE_REGISTRY[code]?.retriable === true
}

function categorizeTaskErrorCode(code: string | undefined): TaskErrorCategory {
  return ERROR_CODE_REGISTRY[code ?? '']?.category ?? 'system'
}

function toTaskErrorInfo(decision: TaskErrorDecision, message: string): TaskErrorInfo {
  return {
    category: decision.category,
    retriable: decision.retriable,
    ...(decision.code ? { code: decision.code } : {}),
    message,
  }
}

// ---------------------------------------------------------------------------
// Adapter 驱动的生命周期函数（worker 编排，IO 注入）
// ---------------------------------------------------------------------------

export async function completeTaskWithAdapter<
  TTask extends { id: string },
  TOutput = Record<string, unknown> | undefined,
>(input: CompleteTaskWithAdapterInput<TTask, TOutput>): Promise<TTask | null> {
  const updatedTask = await input.adapter.markTaskSucceeded(input.task.id, input.output)
  if (updatedTask) await input.adapter.notifyTaskStatusChange(updatedTask)
  return updatedTask
}

export async function claimNextTaskWithAdapter<TTask>(
  input: ClaimNextTaskWithAdapterInput<TTask>,
): Promise<TTask | null> {
  return input.adapter.claimNextTask(input.workerId, input.claimTtlMs)
}

export async function sweepOrphanTasksWithAdapter(input: SweepOrphanTasksWithAdapterInput): Promise<number> {
  return input.adapter.sweepOrphanTasks(input.timeoutMinutes)
}

export async function extendTaskLockWithAdapter<TTask>(
  input: ExtendTaskLockWithAdapterInput<TTask>,
): Promise<TTask | null> {
  return input.adapter.extendTaskLock(input.taskId, input.workerId, input.claimTtlMs)
}

export async function cancelTaskWithAdapter<TTask>(
  input: CancelTaskWithAdapterInput<TTask>,
): Promise<TTask | null> {
  return input.adapter.cancelTask(input.taskId)
}

export async function applyTaskFailureWithAdapter<TTask extends TaskRetryCandidate & { id: string }>(
  input: ApplyTaskFailureWithAdapterInput<TTask>,
): Promise<ApplyTaskFailureWithAdapterResult> {
  const failureAction = decideTaskFailureAction(input.task, input.error)
  if (failureAction.action === 'retry') {
    const nextRunAt = new Date((input.now?.() ?? Date.now()) + failureAction.delayMs)
    await input.adapter.markTaskRetrying(input.task.id, nextRunAt)
    return { action: 'retry', decision: failureAction.decision, delayMs: failureAction.delayMs, nextRunAt }
  }
  const errorMessage = input.error instanceof Error ? input.error.message : String(input.error)
  const errorInfo = toTaskErrorInfo(failureAction.decision, errorMessage)
  await input.adapter.markTaskFailed(input.task.id, errorInfo, errorMessage)
  return { action: 'fail', decision: failureAction.decision, errorInfo, errorMessage }
}
