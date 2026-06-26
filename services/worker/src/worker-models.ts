import type { ModelConfig } from '@seq/bailian-core'
import { wan27T2v } from './models/wan27-t2v'
import { wan27I2v } from './models/wan27-i2v'
import { wan27R2v } from './models/wan27-r2v'
import { happyhorseT2v } from './models/happyhorse-t2v'
import { viduQ3ProT2v, viduQ3TurboT2v, viduQ2T2v } from './models/vidu-t2v'
import { pixverseC1T2v, pixverseV6T2v, pixverseV56T2v } from './models/pixverse-t2v'
import { klingV3T2v, klingV3OmniT2v } from './models/kling-t2v'
import { qwenTextToImage } from './models/qwen-t2i'
import { klingImageGen, klingOmniImageGen, wan27ImagePro, wan27Image, zImageTurbo, qwenImageEdit, qwenImageTranslation } from './models/image-all'
import { funMusicV1 } from './models/fun-music'
import {
  happyhorseI2v, viduQ3ProI2v, viduQ3TurboI2v, viduQ2ProFastI2v, viduQ2ProI2v, viduQ2TurboI2v,
  viduQ3ProI2vKF, viduQ3TurboI2vKF, viduQ2ProI2vKF, viduQ2TurboI2vKF,
  pixverseC1I2v, pixverseV6I2v, pixverseV56I2v,
  pixverseC1I2vKF, pixverseV6I2vKF, pixverseV56I2vKF,
  klingV3I2v, klingV3OmniI2v, klingV3I2vKF, klingV3OmniI2vKF,
} from './models/video-i2v'
import {
  happyhorseR2v, viduQ3MixR2v, viduQ3R2v, viduQ3TurboR2v, viduQ2ProR2v, viduQ2R2v,
  pixverseC1R2v, pixverseV6R2v, pixverseV56R2v, klingV3OmniR2v,
  wan27VideoEdit, happyhorseVideoEdit, klingV3OmniVideoEdit,
} from './models/video-r2v-edit'

/**
 * worker-local 模型元数据表（与 services/api registry 同步，有意冗余）。
 * 共 40 个模型，全部从 v1 uhyc 移植。
 */
const WORKER_MODELS: ModelConfig[] = [
  wan27T2v, happyhorseT2v, viduQ3ProT2v, viduQ3TurboT2v, viduQ2T2v,
  pixverseC1T2v, pixverseV6T2v, pixverseV56T2v, klingV3T2v, klingV3OmniT2v,
  wan27I2v, happyhorseI2v,
  viduQ3ProI2v, viduQ3TurboI2v, viduQ2ProFastI2v, viduQ2ProI2v, viduQ2TurboI2v,
  viduQ3ProI2vKF, viduQ3TurboI2vKF, viduQ2ProI2vKF, viduQ2TurboI2vKF,
  pixverseC1I2v, pixverseV6I2v, pixverseV56I2v,
  pixverseC1I2vKF, pixverseV6I2vKF, pixverseV56I2vKF,
  klingV3I2v, klingV3OmniI2v, klingV3I2vKF, klingV3OmniI2vKF,
  wan27R2v, happyhorseR2v, viduQ3MixR2v, viduQ3R2v, viduQ3TurboR2v, viduQ2ProR2v, viduQ2R2v,
  pixverseC1R2v, pixverseV6R2v, pixverseV56R2v, klingV3OmniR2v,
  wan27VideoEdit, happyhorseVideoEdit, klingV3OmniVideoEdit,
  qwenTextToImage, klingImageGen, klingOmniImageGen, wan27ImagePro, wan27Image, zImageTurbo,
  qwenImageEdit, qwenImageTranslation,
  funMusicV1,
]

export function getWorkerModelConfig(
  category: string,
  subCategory: string,
  model: string,
): ModelConfig | undefined {
  return WORKER_MODELS.find(
    (m) => m.category === category && m.subCategory === subCategory && m.model === model,
  )
}
