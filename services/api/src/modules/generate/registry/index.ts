import { assertModelConfigConsistent, type ModelConfig } from '@seq/bailian-core'
import { wan27T2v } from './video-wan27-t2v'
import { wan27I2v } from './video-wan27-i2v'
import { wan27R2v } from './video-wan27-r2v'
import { qwenTextToImage } from './image-qwen-t2i'
import { funMusicV1 } from './audio-fun-music'

/**
 * 生成模型注册表 — v2 的业务数据（非纯契约）。
 *
 * 当前为种子集（5 个模型，覆盖全部 requestType + 全部 InputMapping target）：
 *   - wan27-t2v   : video-t2v  （prompt/mediaField/parameter）
 *   - wan27-i2v   : video-media（media 槽位）
 *   - wan27-r2v   : video-media + referenceMediaType
 *   - qwen-t2i    : image（Chat 风格 messages）
 *   - fun-music   : audio（平铺 input 层）
 *
 * TODO（业务数据增量，非架构）：从 v1 uhyc 补全剩余 ~35 个模型
 * （HappyHorse / Vidu / PixVerse / Kling 全系列 + qwen-image-edit / qwen-mt-image / z-image 等）。
 * 每个模型照此 5 个的格式声明，buildRequestBody 无需任何改动即可消费。
 */
export const ALL_MODELS: ModelConfig[] = [wan27T2v, wan27I2v, wan27R2v, qwenTextToImage, funMusicV1]

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
