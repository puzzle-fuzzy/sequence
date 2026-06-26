import type { Task } from '@seq/db'
import { claimNextTask } from '@seq/db'
import {
  claimNextTaskWithAdapter,
  completeTaskWithAdapter,
  applyTaskFailureWithAdapter,
  type TaskClaimAdapter,
} from '@seq/task-engine'
import { createLogger } from '@seq/shared'
import type { WorkerContext } from './context'
import { registry } from './registry'
import { completionAdapter, failureAdapter, makeHeartbeatAdapter } from './adapters'

const logger = createLogger('worker:poll')

const claimAdapter: TaskClaimAdapter<Task> = {
  claimNextTask: (workerId, ttl) => claimNextTask(workerId, ttl),
}

export interface PollSourceRefs {
  currentTaskPromiseRef: { value: Promise<unknown> | null }
}

/**
 * 单任务执行流程（task-engine 纯函数编排 + adapter 注入）：
 *   claim → 启动 heartbeat → registry.handle → complete/retry → 停 heartbeat
 */
export function createTaskPollSource(ctx: WorkerContext, refs: PollSourceRefs) {
  const heartbeat = makeHeartbeatAdapter(ctx.config.workerId, ctx.config.claimTtlMs)

  return {
    async poll(): Promise<void> {
      const task = await claimNextTaskWithAdapter<Task>({
        workerId: ctx.config.workerId,
        claimTtlMs: ctx.config.claimTtlMs,
        adapter: claimAdapter,
      })
      if (!task) return

      const taskPromise = (async () => {
        // heartbeat 续锁（任务执行期间定时续，间隔 = claimTtl/2）
        const hbInterval = Math.max(1000, Math.floor(ctx.config.claimTtlMs / 2))
        const hb = setInterval(() => {
          void heartbeat.extendTaskLock(task.id, ctx.config.workerId, ctx.config.claimTtlMs)
        }, hbInterval)
        try {
          const output = await registry.handle(task, ctx)
          await completeTaskWithAdapter<Task>({ task, output, adapter: completionAdapter })
        } catch (e) {
          const result = await applyTaskFailureWithAdapter<Task>({
            task,
            error: e,
            adapter: failureAdapter,
          })
          logger.warn({ taskId: task.id, action: result.action }, 'task failed/retrying')
        } finally {
          clearInterval(hb)
        }
      })()

      refs.currentTaskPromiseRef.value = taskPromise
      try {
        await taskPromise
      } finally {
        refs.currentTaskPromiseRef.value = null
      }
    },
  }
}
