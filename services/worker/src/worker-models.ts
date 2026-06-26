import type { ModelConfig } from '@seq/bailian-core'
import { wan27T2v } from './models/wan27-t2v'
import { wan27I2v } from './models/wan27-i2v'
import { wan27R2v } from './models/wan27-r2v'
import { qwenTextToImage } from './models/qwen-t2i'
import { funMusicV1 } from './models/fun-music'

/**
 * worker-local 模型元数据表。
 *
 * 有意与 services/api 的 registry 重复（services 之间不互相 import）。
 * 新增模型时两处同步登记。这是 worker↔api 边界的明确决策 —— 见
 * docs/superpowers/plans/2026-06-26-phase7-services-worker.md（Scope decisions）。
 */
const WORKER_MODELS: ModelConfig[] = [wan27T2v, wan27I2v, wan27R2v, qwenTextToImage, funMusicV1]

export function getWorkerModelConfig(
  category: string,
  subCategory: string,
  model: string,
): ModelConfig | undefined {
  return WORKER_MODELS.find(
    (m) => m.category === category && m.subCategory === subCategory && m.model === model,
  )
}
