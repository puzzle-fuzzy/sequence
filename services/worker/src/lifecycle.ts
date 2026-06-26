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
export function startHealthServer(port: number, state: HealthState): { stop: () => void } {
  const app = new Elysia()
    .get('/live', () => ({
      ok: true,
      workerId: state.workerId,
      isPolling: state.isPolling,
      lastPollAt: state.lastPollAt?.toISOString() ?? null,
      lastPollError: state.lastPollError,
    }))
    .listen(port)
  return { stop: () => app.stop() }
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
): void {
  const handler = async (sig: string) => {
    logger.info({ sig }, 'received signal, shutting down')
    runningRef.value = false
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
  process.on('SIGINT', () => void handler('SIGINT'))
  process.on('SIGTERM', () => void handler('SIGTERM'))
}
