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
