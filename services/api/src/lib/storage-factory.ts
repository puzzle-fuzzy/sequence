import { AssetStorage, type StorageConfig } from '@seq/storage'
import type { AppConfig } from '@seq/shared'
import type { ServerConfig } from '../config'

let storageInstance: AssetStorage | null = null

/** AssetStorage 单例 — 由 ServerConfig 驱动（本地 / OSS）。 */
export function getAssetStorage(config: ServerConfig): AssetStorage {
  if (storageInstance) return storageInstance
  const storageConfig: StorageConfig = {
    storageRoot: config.app.storageDir,
    publicBasePath: '/generate/storage',
    ...(config.app.oss
      ? {
          oss: {
            accessKeyId: config.app.oss.accessKeyId,
            accessKeySecret: config.app.oss.accessKeySecret,
            bucket: config.app.oss.bucket,
            region: config.app.oss.region,
            uploadPrefix: config.app.oss.uploadPrefix,
          },
        }
      : {}),
  }
  storageInstance = new AssetStorage(storageConfig)
  return storageInstance
}

export type { AppConfig }
