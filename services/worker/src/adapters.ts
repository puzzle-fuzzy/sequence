import type { Task } from '@seq/db'
import { markSucceeded, markRetrying, markFailed, extendTaskLock } from '@seq/db'
import {
  type TaskCompletionAdapter,
  type TaskFailureAdapter,
  type TaskHeartbeatAdapter,
} from '@seq/task-engine'
import { createLogger } from '@seq/shared'

const logger = createLogger('worker')

/** task-engine TaskCompletionAdapter — DB-backed 成功标记 + 状态变更通知。 */
export const completionAdapter: TaskCompletionAdapter<Task> = {
  async markTaskSucceeded(id, output) {
    return markSucceeded(id, output ?? {})
  },
  async notifyTaskStatusChange(task) {
    // Phase 7 占位：console 日志。后续接 PG NOTIFY → api SSE listener
    logger.info({ taskId: task.id, status: task.status }, 'task status changed')
  },
}

/** task-engine TaskFailureAdapter — DB-backed retry/fail 标记。 */
export const failureAdapter: TaskFailureAdapter = {
  async markTaskRetrying(id, nextRunAt) {
    await markRetrying(id, nextRunAt)
  },
  async markTaskFailed(id, errorInfo, errorMessage) {
    await markFailed(
      id,
      (errorInfo as unknown as Record<string, unknown> | undefined) ?? {},
      errorMessage ?? errorInfo?.message ?? 'unknown error',
    )
  },
}

/** task-engine TaskHeartbeatAdapter — 续 worker 锁。 */
export function makeHeartbeatAdapter(workerId: string, claimTtlMs: number): TaskHeartbeatAdapter<Task> {
  return {
    async extendTaskLock(id) {
      return extendTaskLock(id, workerId, claimTtlMs)
    },
  }
}
