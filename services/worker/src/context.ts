import { AssetStorage } from '@seq/storage'
import type { BailianClientConfig } from '@seq/bailian-client'
import type { WorkerConfig } from './config'

/** handler 注入的依赖 —— 测试时传 fake（deps override）。 */
export interface WorkerContext {
  config: WorkerConfig
  bailian: BailianClientConfig
  storage: AssetStorage
}

export function createWorkerContext(config: WorkerConfig): WorkerContext {
  return {
    config,
    bailian: { apiKey: config.bailian.apiKey, baseUrl: config.bailian.baseUrl },
    storage: new AssetStorage({ storageRoot: config.storageRoot, publicBasePath: '/generate/storage' }),
  }
}
