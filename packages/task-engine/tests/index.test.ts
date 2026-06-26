import { describe, expect, it, mock } from 'bun:test'
import {
  classifyTaskError,
  decideTaskFailureAction,
  shouldRetryTask,
  computeRetryDelay,
  getTaskPriority,
  createTaskHandlerRegistry,
  TaskHandlerRegistry,
  TaskNotImplementedError,
  TaskInputError,
  TaskLockLostError,
  completeTaskWithAdapter,
  claimNextTaskWithAdapter,
  applyTaskFailureWithAdapter,
  DEFAULT_PRIORITY_POLICY,
  DEFAULT_BACKOFF_POLICY,
} from '../src/index'
import type { TaskRetryCandidate } from '../src/index'

// ---------------------------------------------------------------------------
// classifyTaskError
// ---------------------------------------------------------------------------

describe('classifyTaskError', () => {
  it('classifies TaskNotImplementedError as non-retriable validation', () => {
    const d = classifyTaskError(new TaskNotImplementedError('x'))
    expect(d.category).toBe('validation')
    expect(d.retriable).toBe(false)
  })
  it('classifies TaskInputError as non-retriable validation', () => {
    const d = classifyTaskError(new TaskInputError('bad input'))
    expect(d.category).toBe('validation')
    expect(d.retriable).toBe(false)
  })
  it('classifies TaskLockLostError as retriable system', () => {
    const d = classifyTaskError(new TaskLockLostError('t1', 'w1'))
    expect(d.category).toBe('system')
    expect(d.retriable).toBe(true)
    expect(d.code).toBe('LOCK_LOST')
  })
  it('classifies known retriable error code from error.code', () => {
    const e = new Error('rate limited')
    ;(e as { code?: string }).code = 'Throttling'
    const d = classifyTaskError(e)
    expect(d.category).toBe('provider_error')
    expect(d.retriable).toBe(true)
    expect(d.code).toBe('Throttling')
  })
  it('classifies known retriable error code from error.cause.code', () => {
    const e = new Error('reset', { cause: { code: 'ECONNRESET' } })
    const d = classifyTaskError(e)
    expect(d.retriable).toBe(true)
    expect(d.code).toBe('ECONNRESET')
  })
  it('defaults unknown codes to system / non-retriable', () => {
    const e = new Error('mystery')
    ;(e as { code?: string }).code = 'MysteryCode'
    const d = classifyTaskError(e)
    expect(d.category).toBe('system')
    expect(d.retriable).toBe(false)
  })
  it('classifies non-Error values as non-retriable system', () => {
    const d = classifyTaskError('a string')
    expect(d.category).toBe('system')
    expect(d.retriable).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// decideTaskFailureAction
// ---------------------------------------------------------------------------

const candidate = (over: Partial<TaskRetryCandidate>): TaskRetryCandidate & { id: string } => ({
  id: 't1',
  type: 'generate.video',
  attempts: 1,
  maxAttempts: 3,
  ...over,
})

describe('decideTaskFailureAction', () => {
  it('retries when retriable and under maxAttempts', () => {
    const a = decideTaskFailureAction(candidate({ attempts: 1, maxAttempts: 3 }), new TaskLockLostError('t1', 'w1'))
    expect(a.action).toBe('retry')
    if (a.action === 'retry') expect(a.delayMs).toBeGreaterThan(0)
  })
  it('fails when retriable but at maxAttempts', () => {
    const a = decideTaskFailureAction(candidate({ attempts: 3, maxAttempts: 3 }), new TaskLockLostError('t1', 'w1'))
    expect(a.action).toBe('fail')
  })
  it('fails immediately for non-retriable errors', () => {
    const a = decideTaskFailureAction(candidate({ attempts: 0, maxAttempts: 3 }), new TaskInputError('bad'))
    expect(a.action).toBe('fail')
  })
})

describe('shouldRetryTask', () => {
  it('true when retriable and attempts < max', () => {
    expect(shouldRetryTask(new TaskLockLostError('t1', 'w1'), 1, 3)).toBe(true)
  })
  it('false when at max', () => {
    expect(shouldRetryTask(new TaskLockLostError('t1', 'w1'), 3, 3)).toBe(false)
  })
  it('false when non-retriable', () => {
    expect(shouldRetryTask(new TaskInputError('bad'), 0, 3)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeRetryDelay / getTaskPriority (策略表)
// ---------------------------------------------------------------------------

describe('computeRetryDelay', () => {
  it('uses fixedInterval for polling tasks', () => {
    expect(computeRetryDelay('generate.video', 1)).toBe(5_000)
  })
  it('uses default for unknown types', () => {
    expect(computeRetryDelay('unknown.type', 1)).toBe(DEFAULT_BACKOFF_POLICY.default)
  })
  it('exponential caps at 2^3', () => {
    const policy = { ...DEFAULT_BACKOFF_POLICY, exponentialBase: { 'exp.task': 1000 } }
    expect(computeRetryDelay('exp.task', 1, policy)).toBe(1000) // 1000 * 2^0
    expect(computeRetryDelay('exp.task', 2, policy)).toBe(2000) // 1000 * 2^1
    expect(computeRetryDelay('exp.task', 10, policy)).toBe(8000) // capped 1000 * 2^3
  })
})

describe('getTaskPriority', () => {
  it('type override wins', () => {
    expect(getTaskPriority({ type: 'generate.video', domain: 'generate' })).toBe(4)
  })
  it('falls back to domain when type unknown', () => {
    expect(getTaskPriority({ type: 'generate.other', domain: 'generate' })).toBe(5)
  })
  it('uses default when neither known', () => {
    expect(getTaskPriority({ type: 'x', domain: 'unknown' })).toBe(DEFAULT_PRIORITY_POLICY.default)
  })
})

// ---------------------------------------------------------------------------
// TaskHandlerRegistry
// ---------------------------------------------------------------------------

describe('TaskHandlerRegistry', () => {
  it('registers and dispatches by task.type', async () => {
    const registry = createTaskHandlerRegistry<{ type: string }, unknown, { ok: true }>([
      { type: 'a', handler: async () => ({ ok: true }) },
    ])
    expect(registry.has('a')).toBe(true)
    expect(await registry.handle({ type: 'a' }, null)).toEqual({ ok: true })
  })
  it('throws TaskNotImplementedError for unregistered type', async () => {
    const registry = new TaskHandlerRegistry<{ type: string }, unknown>()
    await expect(registry.handle({ type: 'nope' }, null)).rejects.toBeInstanceOf(TaskNotImplementedError)
  })
  it('listTypes returns registered types', () => {
    const registry = createTaskHandlerRegistry<{ type: string }, unknown>([
      { type: 'a', handler: () => undefined },
      { type: 'b', handler: () => undefined },
    ])
    expect(registry.listTypes().sort()).toEqual(['a', 'b'])
  })
})

// ---------------------------------------------------------------------------
// Adapter 驱动的生命周期函数
// ---------------------------------------------------------------------------

describe('completeTaskWithAdapter', () => {
  it('marks succeeded then notifies', async () => {
    const markSucceeded = mock(() => Promise.resolve({ id: 't1', status: 'succeeded' }))
    const notify = mock(() => Promise.resolve())
    const out = await completeTaskWithAdapter<{ id: string; status: string }>({
      task: { id: 't1', status: 'running' },
      output: { result: 'x' },
      adapter: { markTaskSucceeded: markSucceeded as never, notifyTaskStatusChange: notify },
    })
    expect(markSucceeded).toHaveBeenCalledWith('t1', { result: 'x' })
    expect(notify).toHaveBeenCalledTimes(1)
    expect((out as { id: string }).id).toBe('t1')
  })
  it('does not notify when markSucceeded returns null', async () => {
    const notify = mock(() => Promise.resolve())
    await completeTaskWithAdapter<{ id: string; status: string }>({
      task: { id: 't1', status: 'running' },
      adapter: { markTaskSucceeded: () => Promise.resolve(null), notifyTaskStatusChange: notify },
    })
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('claimNextTaskWithAdapter', () => {
  it('delegates to adapter.claimNextTask with workerId + ttl', async () => {
    const claim = mock(() => Promise.resolve({ id: 't1' }))
    const out = await claimNextTaskWithAdapter({ workerId: 'w1', claimTtlMs: 60000, adapter: { claimNextTask: claim } })
    expect(claim).toHaveBeenCalledWith('w1', 60000)
    expect((out as { id: string }).id).toBe('t1')
  })
})

describe('applyTaskFailureWithAdapter', () => {
  it('retry path calls markTaskRetrying with future nextRunAt', async () => {
    const markRetrying = mock(() => Promise.resolve())
    const markFailed = mock(() => Promise.resolve())
    const now = mock(() => 1000)
    const result = await applyTaskFailureWithAdapter({
      task: { id: 't1', attempts: 1, maxAttempts: 3, type: 'generate.video' },
      error: new TaskLockLostError('t1', 'w1'),
      adapter: { markTaskRetrying: markRetrying, markTaskFailed: markFailed },
      now,
    })
    expect(result.action).toBe('retry')
    if (result.action === 'retry') {
      expect(markRetrying).toHaveBeenCalledTimes(1)
      expect(markFailed).not.toHaveBeenCalled()
      const calledArg = (markRetrying.mock.calls as unknown as unknown[][])[0]![1] as Date
      expect(calledArg.getTime()).toBe(1000 + result.delayMs)
    }
  })
  it('fail path calls markTaskFailed with errorInfo', async () => {
    const markRetrying = mock(() => Promise.resolve())
    const markFailed = mock(() => Promise.resolve())
    const result = await applyTaskFailureWithAdapter({
      task: { id: 't1', attempts: 3, maxAttempts: 3, type: 'generate.video' },
      error: new TaskInputError('bad data'),
      adapter: { markTaskRetrying: markRetrying, markTaskFailed: markFailed },
    })
    expect(result.action).toBe('fail')
    if (result.action === 'fail') {
      expect(markFailed).toHaveBeenCalledTimes(1)
      expect(markRetrying).not.toHaveBeenCalled()
      expect(result.errorInfo.retriable).toBe(false)
    }
  })
})
