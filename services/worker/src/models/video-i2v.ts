import type { ModelConfig, ModelParameter, InputMapping } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// video image-to-video 全系列（20 个模型）
// 对应 v1: packages/bailian/src/video/models/{happyhorse,vidu,pixverse,kling}-i2v*.ts
// 全部 video-media requestType，差异在 media 槽位类型 + 定价 + 字段细节。
// ---------------------------------------------------------------------------

const EP = '/services/aigc/video-generation/video-synthesis'

// ---- 公共字段片段 ----
const viduRes = (def = '720P'): ModelParameter => ({
  name: 'resolution', label: '分辨率', type: 'select', defaultValue: def,
  options: [{ label: '540P', value: '540P' }, { label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }],
})
const pixverseRes: ModelParameter = {
  name: 'resolution', label: '分辨率', type: 'select', required: true, defaultValue: '720P',
  options: [{ label: '360P', value: '360P' }, { label: '540P', value: '540P' }, { label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }],
}
const watermarkAI: ModelParameter = { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '水印位于视频右下角，文案为 "AI生成"' }
const seed: ModelParameter = { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647, description: '固定种子可提升结果可复现性。留空则系统自动生成' }
const audio: ModelParameter = { name: 'audio', label: '生成音频', type: 'boolean', defaultValue: false, description: '是否生成背景音乐和音效（仅 Q3 系列支持）' }

// video-media 的标准 inputMapping（prompt + media + parameters）
const mediaMapping = (extra: Record<string, InputMapping> = {}): InputMapping extends never ? never : Record<string, InputMapping> => extra as never
const I2V_MAP: Record<string, InputMapping> = {
  prompt: { target: 'prompt' },
  media: { target: 'media', mediaType: 'first_frame' },
  resolution: { target: 'parameter' },
  duration: { target: 'parameter' },
  audio: { target: 'parameter' },
  watermark: { target: 'parameter' },
  seed: { target: 'parameter' },
  mode: { target: 'parameter' },
  shot_type: { target: 'parameter' },
}

// ---- HappyHorse i2v ----
export const happyhorseI2v: ModelConfig = {
  id: 'happyhorse-i2v', model: 'happyhorse-1.1-i2v', supportedModels: ['happyhorse-1.1-i2v', 'happyhorse-1.0-i2v'],
  displayName: 'HappyHorse 图生视频', category: 'video', subCategory: 'image-to-video',
  endpoint: EP, async: true,
  pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers: [{ condition: { resolution: '720P' }, price: 0.9 }, { condition: { resolution: '1080P' }, price: 1.2 }] },
  requestType: 'video-media',
  parameters: [
    { name: 'media', label: '首帧图像', type: 'media', required: true, description: '输入首帧图像（有且仅有1张）。格式：JPEG/JPG/PNG/WEBP，分辨率宽高≥300px，≤20MB', mediaSlots: [{ type: 'first_frame', label: '首帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 20 }] },
    { name: 'prompt', label: '文本提示词', type: 'text', maxLength: 5000, description: '描述期望生成的视频内容，可选' },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1080P', options: [{ label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }], description: '输出视频宽高比自动跟随输入首帧图像' },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 3, max: 15, description: '单位：秒，取值范围 [3, 15]' },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: true, description: '水印位于视频右下角，文案为 "Happy Horse"' },
    seed,
  ],
  inputMapping: I2V_MAP,
}

// ---- Vidu i2v（首帧）共用的字段集 ----
const viduI2vFields = (max: number, withAudio: boolean): ModelParameter[] => [
  { name: 'prompt', label: '文本提示词', type: 'text', maxLength: 5000, description: '描述期望生成的视频内容（可选）' },
  { name: 'media', label: '首帧图片', type: 'media', required: true, description: '作为视频首帧的参考图片。支持 JPG/JPEG/PNG/WEBP，不超过 50MB', mediaSlots: [{ type: 'image', label: '首帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 50 }] },
  ...(withAudio ? [audio] : []),
  viduRes(),
  { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 1, max, description: '单位：秒' },
  watermarkAI,
  seed,
]

const viduI2v = (id: string, model: string, displayName: string, tiers: ModelConfig['pricing']['tiers'], max: number, withAudio: boolean): ModelConfig => ({
  id, model, supportedModels: [model], displayName, category: 'video', subCategory: 'image-to-video',
  endpoint: EP, async: true,
  pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers },
  requestType: 'video-media',
  parameters: viduI2vFields(max, withAudio),
  inputMapping: I2V_MAP,
})

export const viduQ3ProI2v = viduI2v('vidu-q3-pro-i2v', 'vidu/viduq3-pro_img2video', 'Vidu Q3 Pro 图生视频（首帧）', [{ condition: { resolution: '540P' }, price: 0.3125 }, { condition: { resolution: '720P' }, price: 0.78125 }, { condition: { resolution: '1080P' }, price: 0.9375 }], 16, true)
export const viduQ3TurboI2v = viduI2v('vidu-q3-turbo-i2v', 'vidu/viduq3-turbo_img2video', 'Vidu Q3 Turbo 图生视频（首帧）', [{ condition: { resolution: '540P' }, price: 0.25 }, { condition: { resolution: '720P' }, price: 0.375 }, { condition: { resolution: '1080P' }, price: 0.4375 }], 16, true)
export const viduQ2ProFastI2v: ModelConfig = {
  id: 'vidu-q2-pro-fast-i2v', model: 'vidu/viduq2-pro-fast_img2video', supportedModels: ['vidu/viduq2-pro-fast_img2video'],
  displayName: 'Vidu Q2 Pro-Fast 图生视频（首帧）', category: 'video', subCategory: 'image-to-video',
  endpoint: EP, async: true,
  pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers: [{ condition: { resolution: '720P' }, price: 0.1 }, { condition: { resolution: '1080P' }, price: 0.2 }] },
  requestType: 'video-media',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', maxLength: 5000, description: '描述期望生成的视频内容（可选）' },
    { name: 'media', label: '首帧图片', type: 'media', required: true, description: '作为视频首帧的参考图片。不超过 50MB', mediaSlots: [{ type: 'image', label: '首帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 50 }] },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '720P', options: [{ label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 1, max: 16, description: '单位：秒' },
    watermarkAI, seed,
  ],
  inputMapping: I2V_MAP,
}
export const viduQ2ProI2v = viduI2v('vidu-q2-pro-i2v', 'vidu/viduq2-pro_img2video', 'Vidu Q2 Pro 图生视频（首帧）', [{ condition: { resolution: '540P' }, price: 0.15625 }, { condition: { resolution: '720P' }, price: 0.34375 }, { condition: { resolution: '1080P' }, price: 0.71875 }], 10, false)
export const viduQ2TurboI2v = viduI2v('vidu-q2-turbo-i2v', 'vidu/viduq2-turbo_img2video', 'Vidu Q2 Turbo 图生视频（首帧）', [{ condition: { resolution: '540P' }, price: 0.0875 }, { condition: { resolution: '720P' }, price: 0.25 }, { condition: { resolution: '1080P' }, price: 0.46875 }], 10, false)

// ---- Vidu i2v（首尾帧）----
const viduKfFields = (max: number, withAudio: boolean): ModelParameter[] => [
  { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '描述期望生成的视频内容（必填）' },
  { name: 'media', label: '首尾帧图片', type: 'media', required: true, description: '2 张图片：第1张为首帧，第2张为尾帧。分辨率比值 0.8~1.25，不超过 50MB', mediaSlots: [{ type: 'image', label: '首帧图片 (第1张)', accept: 'image/*', maxCount: 1, maxSizeMB: 50 }, { type: 'image', label: '尾帧图片 (第2张)', accept: 'image/*', maxCount: 1, maxSizeMB: 50 }] },
  ...(withAudio ? [audio] : []),
  viduRes(),
  { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 1, max, description: '单位：秒' },
  watermarkAI, seed,
]
const viduKf = (id: string, model: string, displayName: string, tiers: ModelConfig['pricing']['tiers'], max: number, withAudio: boolean): ModelConfig => ({
  id, model, supportedModels: [model], displayName, category: 'video', subCategory: 'image-to-video',
  endpoint: EP, async: true, pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers },
  requestType: 'video-media', parameters: viduKfFields(max, withAudio), inputMapping: I2V_MAP,
})
export const viduQ3ProI2vKF = viduKf('vidu-q3-pro-i2v-kf', 'vidu/viduq3-pro_start-end2video', 'Vidu Q3 Pro 图生视频（首尾帧）', [{ condition: { resolution: '540P' }, price: 0.3125 }, { condition: { resolution: '720P' }, price: 0.78125 }, { condition: { resolution: '1080P' }, price: 0.9375 }], 16, true)
export const viduQ3TurboI2vKF = viduKf('vidu-q3-turbo-i2v-kf', 'vidu/viduq3-turbo_start-end2video', 'Vidu Q3 Turbo 图生视频（首尾帧）', [{ condition: { resolution: '540P' }, price: 0.25 }, { condition: { resolution: '720P' }, price: 0.375 }, { condition: { resolution: '1080P' }, price: 0.4375 }], 16, true)
export const viduQ2ProI2vKF = viduKf('vidu-q2-pro-i2v-kf', 'vidu/viduq2-pro_start-end2video', 'Vidu Q2 Pro 图生视频（首尾帧）', [{ condition: { resolution: '540P' }, price: 0.15625 }, { condition: { resolution: '720P' }, price: 0.34375 }, { condition: { resolution: '1080P' }, price: 0.71875 }], 10, false)
export const viduQ2TurboI2vKF = viduKf('vidu-q2-turbo-i2v-kf', 'vidu/viduq2-turbo_start-end2video', 'Vidu Q2 Turbo 图生视频（首尾帧）', [{ condition: { resolution: '540P' }, price: 0.0875 }, { condition: { resolution: '720P' }, price: 0.25 }, { condition: { resolution: '1080P' }, price: 0.46875 }], 10, false)

// ---- PixVerse i2v（首帧）----
const pixverseI2vFields = (v56 = false): ModelParameter[] => [
  { name: 'prompt', label: '文本提示词', type: 'text', maxLength: v56 ? 2048 : 5000, description: '描述期望生成的视频内容（可选）' },
  { name: 'media', label: '首帧图片', type: 'media', required: true, description: '作为视频首帧的参考图片。支持 JPG/PNG/WEBP，不超过 20MB', mediaSlots: [{ type: 'image_url', label: '首帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 20 }] },
  pixverseRes,
  { name: 'duration', label: '视频时长', type: 'number', required: true, defaultValue: 5, min: 1, max: 15, description: '单位：秒' },
  { name: 'audio', label: '生成音频', type: 'boolean', defaultValue: false, description: '是否生成背景音乐和音效' },
  watermarkAI, seed,
]
const pixverseI2v = (id: string, model: string, displayName: string, tiers: ModelConfig['pricing']['tiers'], extra?: ModelParameter): ModelConfig => {
  const params = pixverseI2vFields(id.includes('v56'))
  if (extra) params.push(extra)
  return { id, model, supportedModels: [model], displayName, category: 'video', subCategory: 'image-to-video', endpoint: EP, async: true, pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers }, requestType: 'video-media', parameters: params, inputMapping: I2V_MAP }
}
export const pixverseC1I2v = pixverseI2v('pixverse-c1-i2v', 'pixverse/pixverse-c1-it2v', 'PixVerse C1 图生视频（首帧）', [{ condition: { resolution: '360P' }, price: 0.18 }, { condition: { resolution: '540P' }, price: 0.24 }, { condition: { resolution: '720P' }, price: 0.3 }, { condition: { resolution: '1080P' }, price: 0.56 }])
export const pixverseV6I2v = pixverseI2v('pixverse-v6-i2v', 'pixverse/pixverse-v6-it2v', 'PixVerse V6 图生视频（首帧）', [{ condition: { resolution: '360P' }, price: 0.15 }, { condition: { resolution: '540P' }, price: 0.21 }, { condition: { resolution: '720P' }, price: 0.27 }, { condition: { resolution: '1080P' }, price: 0.53 }], { name: 'shot_type', label: '镜头模式', type: 'select', defaultValue: 'single', options: [{ label: '单镜头', value: 'single' }, { label: '多镜头/智能分镜', value: 'multi' }], description: 'V6 支持多镜头智能分镜' })
export const pixverseV56I2v = pixverseI2v('pixverse-v56-i2v', 'pixverse/pixverse-v5.6-it2v', 'PixVerse V5.6 图生视频（首帧）', [{ condition: { resolution: '360P' }, price: 0.21 }, { condition: { resolution: '540P' }, price: 0.21 }, { condition: { resolution: '720P' }, price: 0.27 }, { condition: { resolution: '1080P' }, price: 0.44 }])

// ---- PixVerse i2v（首尾帧）----
const pixverseKfFields = (v56 = false): ModelParameter[] => [
  { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: v56 ? 2048 : 5000, description: '描述期望生成的视频内容（必填）' },
  { name: 'media', label: '首尾帧图片', type: 'media', required: true, description: '2 张图片：首帧 + 尾帧。不超过 20MB', mediaSlots: [{ type: 'first_frame', label: '首帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 20 }, { type: 'last_frame', label: '尾帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 20 }] },
  pixverseRes,
  { name: 'duration', label: '视频时长', type: 'number', required: true, defaultValue: 5, min: 1, max: 15, description: '单位：秒' },
  { name: 'audio', label: '生成音频', type: 'boolean', defaultValue: false, description: '是否生成背景音乐和音效' },
  watermarkAI, seed,
]
const pixverseKf = (id: string, model: string, displayName: string, tiers: ModelConfig['pricing']['tiers']): ModelConfig => ({
  id, model, supportedModels: [model], displayName, category: 'video', subCategory: 'image-to-video',
  endpoint: EP, async: true, pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers },
  requestType: 'video-media', parameters: pixverseKfFields(id.includes('v56')), inputMapping: I2V_MAP,
})
export const pixverseC1I2vKF = pixverseKf('pixverse-c1-i2v-kf', 'pixverse/pixverse-c1-kf2v', 'PixVerse C1 图生视频（首尾帧）', [{ condition: { resolution: '360P' }, price: 0.18 }, { condition: { resolution: '540P' }, price: 0.24 }, { condition: { resolution: '720P' }, price: 0.3 }, { condition: { resolution: '1080P' }, price: 0.56 }])
export const pixverseV6I2vKF = pixverseKf('pixverse-v6-i2v-kf', 'pixverse/pixverse-v6-kf2v', 'PixVerse V6 图生视频（首尾帧）', [{ condition: { resolution: '360P' }, price: 0.15 }, { condition: { resolution: '540P' }, price: 0.21 }, { condition: { resolution: '720P' }, price: 0.27 }, { condition: { resolution: '1080P' }, price: 0.53 }])
export const pixverseV56I2vKF = pixverseKf('pixverse-v56-i2v-kf', 'pixverse/pixverse-v5.6-kf2v', 'PixVerse V5.6 图生视频（首尾帧）', [{ condition: { resolution: '360P' }, price: 0.21 }, { condition: { resolution: '540P' }, price: 0.21 }, { condition: { resolution: '720P' }, price: 0.27 }, { condition: { resolution: '1080P' }, price: 0.44 }])

// ---- Kling i2v（首帧 + 首尾帧）----
const klingI2vMap: Record<string, InputMapping> = { ...I2V_MAP }
const klingMode: ModelParameter = { name: 'mode', label: '生成模式', type: 'select', defaultValue: 'pro', options: [{ label: '专业版 (1080P)', value: 'pro' }, { label: '标准版 (720P)', value: 'std' }], description: 'pro=1080P 专业品质，std=720P 标准品质' }
const klingBase = (mediaField: ModelParameter, promptDesc: string): ModelParameter[] => [
  { name: 'prompt', label: '文本提示词', type: 'text', maxLength: 2500, description: promptDesc },
  mediaField, klingMode,
  { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 3, max: 15, description: '单位：秒，取值范围 [3, 15]' },
  { name: 'audio', label: '生成音频', type: 'boolean', defaultValue: false, description: '是否生成背景音乐和音效' },
  { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '水印位于视频右下角，文案为 "可灵AI"' },
]
const klingFirstFrameMedia: ModelParameter = { name: 'media', label: '首帧图片', type: 'media', required: true, description: '作为视频首帧的参考图片。300~8000px，不超过 10MB', mediaSlots: [{ type: 'first_frame', label: '首帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 10 }] }
const klingKeyframeMedia: ModelParameter = { name: 'media', label: '首尾帧图片', type: 'media', required: true, description: '2 张图片：首帧 + 尾帧。不超过 10MB', mediaSlots: [{ type: 'first_frame', label: '首帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 10 }, { type: 'last_frame', label: '尾帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 10 }] }
const klingTiers = [{ condition: { mode: 'std' }, price: 0.6 }, { condition: { mode: 'pro' }, price: 0.8 }]
const klingCfg = (id: string, model: string, displayName: string, params: ModelParameter[]): ModelConfig => ({
  id, model, supportedModels: [model], displayName, category: 'video', subCategory: 'image-to-video',
  endpoint: EP, async: true, pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers: klingTiers },
  requestType: 'video-media', parameters: params, inputMapping: klingI2vMap,
})
export const klingV3I2v = klingCfg('kling-v3-i2v', 'kling/kling-v3-video-generation', '可灵 V3 图生视频（首帧）', klingBase(klingFirstFrameMedia, '描述期望生成的视频内容（可选）'))
export const klingV3OmniI2v = klingCfg('kling-v3-omni-i2v', 'kling/kling-v3-omni-video-generation', '可灵 V3 Omni 图生视频（首帧）', klingBase(klingFirstFrameMedia, '描述期望生成的视频内容（可选）。Omni 模型支持 <<<element_N>>> 和 <<<image_1>>> 语法引用主体和图片'))
export const klingV3I2vKF = klingCfg('kling-v3-i2v-kf', 'kling/kling-v3-video-generation', '可灵 V3 图生视频（首尾帧）', klingBase(klingKeyframeMedia, '描述期望生成的视频内容（可选）'))
export const klingV3OmniI2vKF = klingCfg('kling-v3-omni-i2v-kf', 'kling/kling-v3-omni-video-generation', '可灵 V3 Omni 图生视频（首尾帧）', klingBase(klingKeyframeMedia, '描述期望生成的视频内容（可选）。Omni 模型支持 <<<element_N>>> 语法引用主体'))
