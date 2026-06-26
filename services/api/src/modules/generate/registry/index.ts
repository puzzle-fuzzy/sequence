import { assertModelConfigConsistent, type ModelConfig } from '@seq/bailian-core'

// seed + video-t2v
import { wan27T2v } from './video-wan27-t2v'
import { happyhorseT2v } from './video-happyhorse-t2v'
import { viduQ3ProT2v, viduQ3TurboT2v, viduQ2T2v } from './video-vidu-t2v'
import { pixverseC1T2v, pixverseV6T2v, pixverseV56T2v } from './video-pixverse-t2v'
import { klingV3T2v, klingV3OmniT2v } from './video-kling-t2v'

// video i2v / r2v / edit
import { wan27I2v } from './video-wan27-i2v'
import { wan27R2v } from './video-wan27-r2v'
import {
  happyhorseI2v, viduQ3ProI2v, viduQ3TurboI2v, viduQ2ProFastI2v, viduQ2ProI2v, viduQ2TurboI2v,
  viduQ3ProI2vKF, viduQ3TurboI2vKF, viduQ2ProI2vKF, viduQ2TurboI2vKF,
  pixverseC1I2v, pixverseV6I2v, pixverseV56I2v,
  pixverseC1I2vKF, pixverseV6I2vKF, pixverseV56I2vKF,
  klingV3I2v, klingV3OmniI2v, klingV3I2vKF, klingV3OmniI2vKF,
} from './video-i2v'
import {
  happyhorseR2v, viduQ3MixR2v, viduQ3R2v, viduQ3TurboR2v, viduQ2ProR2v, viduQ2R2v,
  pixverseC1R2v, pixverseV6R2v, pixverseV56R2v, klingV3OmniR2v,
  wan27VideoEdit, happyhorseVideoEdit, klingV3OmniVideoEdit,
} from './video-r2v-edit'

// image
import { qwenTextToImage } from './image-qwen-t2i'
import { klingImageGen, klingOmniImageGen, wan27ImagePro, wan27Image, zImageTurbo, qwenImageEdit, qwenImageTranslation } from './image-all'

// audio
import { funMusicV1 } from './audio-fun-music'

/**
 * 生成模型注册表 — v2 的业务数据。共 40 个模型，全部从 v1 uhyc 移植。
 *
 * video text-to-video（10）: wan2.7/happyhorse/vidu×3/pixverse×3/kling×2
 * video image-to-video（21）: wan2.7-i2v + happyhorse/vidu(首帧5+首尾帧4)/pixverse(首帧3+首尾帧3)/kling(首帧2+首尾帧2)
 * video reference-to-video（10）: wan2.7-r2v + happyhorse/vidu×5/pixverse×3/kling×1
 * video editing（3）: wan2.7/happyhorse/kling
 * image text-to-image（6）: qwen-text-to-image/kling×2/wan×2/z-image
 * image image-to-image（1）: qwen-image-edit
 * image reference-to-image（1）: qwen-image-translation
 * audio text-to-music（1）: fun-music
 */
export const ALL_MODELS: ModelConfig[] = [
  // video t2v
  wan27T2v, happyhorseT2v, viduQ3ProT2v, viduQ3TurboT2v, viduQ2T2v,
  pixverseC1T2v, pixverseV6T2v, pixverseV56T2v, klingV3T2v, klingV3OmniT2v,
  // video i2v
  wan27I2v, happyhorseI2v,
  viduQ3ProI2v, viduQ3TurboI2v, viduQ2ProFastI2v, viduQ2ProI2v, viduQ2TurboI2v,
  viduQ3ProI2vKF, viduQ3TurboI2vKF, viduQ2ProI2vKF, viduQ2TurboI2vKF,
  pixverseC1I2v, pixverseV6I2v, pixverseV56I2v,
  pixverseC1I2vKF, pixverseV6I2vKF, pixverseV56I2vKF,
  klingV3I2v, klingV3OmniI2v, klingV3I2vKF, klingV3OmniI2vKF,
  // video r2v
  wan27R2v, happyhorseR2v, viduQ3MixR2v, viduQ3R2v, viduQ3TurboR2v, viduQ2ProR2v, viduQ2R2v,
  pixverseC1R2v, pixverseV6R2v, pixverseV56R2v, klingV3OmniR2v,
  // video edit
  wan27VideoEdit, happyhorseVideoEdit, klingV3OmniVideoEdit,
  // image
  qwenTextToImage, klingImageGen, klingOmniImageGen, wan27ImagePro, wan27Image, zImageTurbo,
  qwenImageEdit, qwenImageTranslation,
  // audio
  funMusicV1,
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
