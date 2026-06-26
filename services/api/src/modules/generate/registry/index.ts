import { assertModelConfigConsistent, type ModelConfig } from '@seq/bailian-core'
import { wan27T2v } from './video-wan27-t2v'
import { wan27I2v } from './video-wan27-i2v'
import { wan27R2v } from './video-wan27-r2v'
import { qwenTextToImage } from './image-qwen-t2i'
import { funMusicV1 } from './audio-fun-music'
import { happyhorseT2v } from './video-happyhorse-t2v'
import { viduQ3ProT2v, viduQ3TurboT2v, viduQ2T2v } from './video-vidu-t2v'
import { pixverseC1T2v, pixverseV6T2v, pixverseV56T2v } from './video-pixverse-t2v'
import { klingV3T2v, klingV3OmniT2v } from './video-kling-t2v'

/**
 * 生成模型注册表 — v2 的业务数据（非纯契约）。
 *
 * video text-to-video（13 个）：
 *   wan2.7-t2v, happyhorse-t2v, vidu-{q3-pro,q3-turbo,q2}-t2v,
 *   pixverse-{c1,v6,v56}-t2v, kling-{v3,v3-omni}-t2v
 * video image-to-video（1）: wan27-i2v
 * video reference-to-video（1）: wan27-r2v
 * image text-to-image（1）: qwen-text-to-image
 * audio text-to-music（1）: fun-music-v1
 *
 * 仍在移植中（i2v/r2v/edit 全系列 + 剩余 image）：见 Phase 8 plan。
 */
export const ALL_MODELS: ModelConfig[] = [
  wan27T2v, happyhorseT2v, viduQ3ProT2v, viduQ3TurboT2v, viduQ2T2v,
  pixverseC1T2v, pixverseV6T2v, pixverseV56T2v, klingV3T2v, klingV3OmniT2v,
  wan27I2v, wan27R2v, qwenTextToImage, funMusicV1,
]

// 启动时自检：每个 required 参数都必须有 inputMapping 条目
for (const m of ALL_MODELS) {
  assertModelConfigConsistent(m)
}

export function findModel(category: string, subCategory: string, model: string): ModelConfig | undefined {
  return ALL_MODELS.find((m) => m.category === category && m.subCategory === subCategory && m.model === model)
}

export function listModelsByCategory(category: string): ModelConfig[] {
  return ALL_MODELS.filter((m) => m.category === category)
}
