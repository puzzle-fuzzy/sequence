import { createLogger, isPgTableNotFoundError } from './pg-helpers'
import { loadWorkerConfig } from './config'
import { createWorkerContext } from './context'
import {
  createHealthState,
  startHealthServer,
  startOrphanSweep,
  setupGracefulShutdown,
} from './lifecycle'
import { createTaskPollSource } from './poll-source'

const logger = createLogger('worker')

/**
 * Worker 启动入口 — 所有副作用收敛到 main()。
 * import 本文件不触发任何副作用。
 */
async function main(): Promise<void> {
  const config = loadWorkerConfig()
  const ctx = createWorkerContext(config)

  const healthState = createHealthState(config.workerId)
  const healthServer = startHealthServer(config.healthPort, healthState)
  const stopSweep = startOrphanSweep(config)

  const runningRef = { value: true }
  const currentTaskPromiseRef = { value: null as Promise<unknown> | null }
  setupGracefulShutdown(runningRef, currentTaskPromiseRef)

  const pollSource = createTaskPollSource(ctx, { currentTaskPromiseRef })

  logger.info(
    { workerId: config.workerId, pollIntervalMs: config.pollIntervalMs, healthPort: config.healthPort },
    '🤖 Worker started',
  )

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
        logger.error('❌ PostgreSQL 未启动（连接被拒绝），请检查数据库服务')
        healthState.lastPollError = 'ECONNREFUSED'
        break
      }
      healthState.lastPollError = error instanceof Error ? error.message : String(error)
      logger.error({ err: error }, 'worker poll error')
    }
    healthState.isPolling = false

    // 分段 sleep，快速响应退出信号
    let remaining = config.pollIntervalMs
    while (remaining > 0 && runningRef.value) {
      const step = Math.min(remaining, 1000)
      await Bun.sleep(step)
      remaining -= step
    }
  }

  stopSweep()
  healthServer.stop()
  logger.info('🤖 Worker stopped.')
}

main()
