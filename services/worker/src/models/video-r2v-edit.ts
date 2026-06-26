import type { ModelConfig, ModelParameter, InputMapping } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// video reference-to-video（8）+ video-editing（3）全系列
// 全部 video-media requestType。
// ---------------------------------------------------------------------------

const EP = '/services/aigc/video-generation/video-synthesis'

const R2V_MAP: Record<string, InputMapping> = {
  prompt: { target: 'prompt' },
  negative_prompt: { target: 'mediaField', field: 'negative_prompt' },
  media: { target: 'media', mediaType: 'reference_image' },
  resolution: { target: 'parameter' },
  duration: { target: 'parameter' },
  watermark: { target: 'parameter' },
  seed: { target: 'parameter' },
  mode: { target: 'parameter' },
  aspect_ratio: { target: 'parameter' },
  element_list: { target: 'mediaField', field: 'element_list' },
  size: { target: 'parameter' },
}
const watermarkAI: ModelParameter = { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '水印位于视频右下角' }
const seed: ModelParameter = { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647, description: '固定种子可提升结果可复现性' }

// ---- HappyHorse r2v ----
export const happyhorseR2v: ModelConfig = {
  id: 'happyhorse-r2v', model: 'happyhorse-1.1-r2v', supportedModels: ['happyhorse-1.1-r2v', 'happyhorse-1.0-r2v'],
  displayName: 'HappyHorse 参考生视频', category: 'video', subCategory: 'reference-to-video',
  endpoint: EP, async: true, refSyntax: 'bracket-en',
  pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers: [{ condition: { resolution: '720P' }, price: 0.9 }, { condition: { resolution: '1080P' }, price: 1.2 }] },
  requestType: 'video-media', referenceMediaType: 'reference_image',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '用 [Image 1]/[Image 2] 指代参考图片' },
    { name: 'media', label: '参考素材', type: 'media', required: true, description: '参考图片（1-9 张）', mediaSlots: [{ type: 'reference_image', label: '参考图片', accept: 'image/*', maxCount: 9, maxSizeMB: 20 }] },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1080P', options: [{ label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
    { name: 'ratio', label: '宽高比', type: 'select', defaultValue: '16:9', options: [{ label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' }, { label: '1:1', value: '1:1' }, { label: '4:3', value: '4:3' }, { label: '3:4', value: '3:4' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 3, max: 15 },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: true, description: '文案 "Happy Horse"' },
    seed,
  ],
  inputMapping: { ...R2V_MAP, ratio: { target: 'parameter' } },
}

// ---- Vidu r2v（5 变体，image×7 + video×2 混合槽位）----
const viduR2vMedia: ModelParameter = { name: 'media', label: '参考素材', type: 'media', required: true, description: '参考图片（最多7张）+ 参考视频（最多2个）', mediaSlots: [{ type: 'image', label: '参考图片', accept: 'image/*', maxCount: 7, maxSizeMB: 50 }, { type: 'video', label: '参考视频', accept: 'video/*', maxCount: 2, maxSizeMB: 100 }] }
const viduR2vFields = (max: number): ModelParameter[] => [
  { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000 },
  viduR2vMedia,
  { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '720P', options: [{ label: '540P', value: '540P' }, { label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
  { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 1, max },
  watermarkAI, seed,
]
const viduR2v = (id: string, model: string, displayName: string, tiers: ModelConfig['pricing']['tiers'], max: number): ModelConfig => ({
  id, model, supportedModels: [model], displayName, category: 'video', subCategory: 'reference-to-video',
  endpoint: EP, async: true, referenceMediaType: 'image',
  pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers },
  requestType: 'video-media', parameters: viduR2vFields(max), inputMapping: R2V_MAP,
})
export const viduQ3MixR2v = viduR2v('vidu-q3-mix-r2v', 'vidu/viduq3-mix_reference2video', 'Vidu Q3 Mix 参考生视频', [{ condition: { resolution: '720P' }, price: 0.78125 }, { condition: { resolution: '1080P' }, price: 0.9375 }], 8)
export const viduQ3R2v = viduR2v('vidu-q3-r2v', 'vidu/viduq3_reference2video', 'Vidu Q3 参考生视频', [{ condition: { resolution: '540P' }, price: 0.3125 }, { condition: { resolution: '720P' }, price: 0.625 }, { condition: { resolution: '1080P' }, price: 0.78125 }], 8)
export const viduQ3TurboR2v = viduR2v('vidu-q3-turbo-r2v', 'vidu/viduq3-turbo_reference2video', 'Vidu Q3 Turbo 参考生视频', [{ condition: { resolution: '540P' }, price: 0.15625 }, { condition: { resolution: '720P' }, price: 0.3125 }, { condition: { resolution: '1080P' }, price: 0.40625 }], 8)
export const viduQ2ProR2v = viduR2v('vidu-q2-pro-r2v', 'vidu/viduq2-pro_reference2video', 'Vidu Q2 Pro 参考生视频', [{ condition: { resolution: '540P' }, price: 0.15625 }, { condition: { resolution: '720P' }, price: 0.34375 }, { condition: { resolution: '1080P' }, price: 0.71875 }], 8)
export const viduQ2R2v = viduR2v('vidu-q2-r2v', 'vidu/viduq2_reference2video', 'Vidu Q2 参考生视频', [{ condition: { resolution: '540P' }, price: 0.0875 }, { condition: { resolution: '720P' }, price: 0.25 }, { condition: { resolution: '1080P' }, price: 0.46875 }], 8)

// ---- PixVerse r2v（用 size 别名，pricing 按 size 匹配）----
const SIZE_OPTS = [{ label: '360P 16:9', value: '640*360' }, { label: '540P 16:9', value: '1024*576' }, { label: '720P 16:9', value: '1280*720' }, { label: '1080P 16:9', value: '1920*1080' }]
const pixverseR2vFields = (v56 = false): ModelParameter[] => [
  { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: v56 ? 2048 : 5000, description: '用 @ref_name 引用参考图片' },
  { name: 'media', label: '参考素材', type: 'media', required: true, description: '参考图片（最多7张）', mediaSlots: [{ type: 'image_url', label: '参考图片', accept: 'image/*', maxCount: 7, maxSizeMB: 20 }] },
  { name: 'resolution', label: '输出尺寸', type: 'select', required: true, defaultValue: '1280*720', options: SIZE_OPTS, description: '映射为 API 的 size 参数' },
  { name: 'duration', label: '视频时长', type: 'number', required: true, defaultValue: 5, min: 1, max: 15 },
  { name: 'audio', label: '生成音频', type: 'boolean', defaultValue: false },
  watermarkAI, seed,
]
const pixverseR2v = (id: string, model: string, displayName: string, tiers: ModelConfig['pricing']['tiers']): ModelConfig => {
  const params = pixverseR2vFields(id.includes('v56'))
  return {
    id, model, supportedModels: [model], displayName, category: 'video', subCategory: 'reference-to-video',
    endpoint: EP, async: true, referenceMediaType: 'image_url',
    pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers: tiers.map((t) => ({ condition: { size: (t.condition as { resolution?: string }).resolution ?? Object.keys(t.condition)[0] }, price: t.price })) },
    requestType: 'video-media', parameters: params,
    inputMapping: { ...R2V_MAP, resolution: { target: 'parameter', field: 'size' } },
  }
}
export const pixverseC1R2v = pixverseR2v('pixverse-c1-r2v', 'pixverse/pixverse-c1-r2v', 'PixVerse C1 参考生视频', [{ condition: { resolution: '640*360' }, price: 0.18 }, { condition: { resolution: '1024*576' }, price: 0.24 }, { condition: { resolution: '1280*720' }, price: 0.3 }, { condition: { resolution: '1920*1080' }, price: 0.56 }])
export const pixverseV6R2v = pixverseR2v('pixverse-v6-r2v', 'pixverse/pixverse-v6-r2v', 'PixVerse V6 参考生视频', [{ condition: { resolution: '640*360' }, price: 0.15 }, { condition: { resolution: '1024*576' }, price: 0.21 }, { condition: { resolution: '1280*720' }, price: 0.27 }, { condition: { resolution: '1920*1080' }, price: 0.53 }])
export const pixverseV56R2v = pixverseR2v('pixverse-v56-r2v', 'pixverse/pixverse-v5.6-r2v', 'PixVerse V5.6 参考生视频', [{ condition: { resolution: '640*360' }, price: 0.21 }, { condition: { resolution: '1024*576' }, price: 0.21 }, { condition: { resolution: '1280*720' }, price: 0.27 }, { condition: { resolution: '1920*1080' }, price: 0.44 }])

// ---- Kling r2v（element_list + feature/refer/first_frame 槽位）----
export const klingV3OmniR2v: ModelConfig = {
  id: 'kling-v3-omni-r2v', model: 'kling/kling-v3-omni-video-generation', supportedModels: ['kling/kling-v3-omni-video-generation'],
  displayName: '可灵 V3 Omni 参考生视频', category: 'video', subCategory: 'reference-to-video',
  endpoint: EP, async: true,
  pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers: [{ condition: { mode: 'std' }, price: 0.6 }, { condition: { mode: 'pro' }, price: 0.8 }] },
  requestType: 'video-media', referenceMediaType: 'refer',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 2500, description: 'Omni 模型支持 <<<element_N>>> / <<<image_N>>> / <<<video_N>>> 语法' },
    { name: 'media', label: '参考素材', type: 'media', required: true, description: 'feature 视频 + refer 图片 + first_frame', mediaSlots: [{ type: 'feature', label: '特征视频', accept: 'video/*', maxCount: 1, maxSizeMB: 100 }, { type: 'refer', label: '参考图片', accept: 'image/*', maxCount: 7, maxSizeMB: 10 }, { type: 'first_frame', label: '首帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 10 }] },
    { name: 'element_list', label: '主体列表', type: 'multi-text', description: 'JSON 数组 [{element_id: number}]，引用预注册的主体 ID' },
    { name: 'mode', label: '生成模式', type: 'select', defaultValue: 'pro', options: [{ label: '专业版 (1080P)', value: 'pro' }, { label: '标准版 (720P)', value: 'std' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 3, max: 15 },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '文案 "可灵AI"' },
  ],
  inputMapping: R2V_MAP,
}

// ---------------------------------------------------------------------------
// video-editing（3）
// ---------------------------------------------------------------------------
const EDIT_MAP: Record<string, InputMapping> = {
  prompt: { target: 'prompt' },
  negative_prompt: { target: 'mediaField', field: 'negative_prompt' },
  media: { target: 'media', mediaType: 'video' },
  resolution: { target: 'parameter' },
  ratio: { target: 'parameter' },
  duration: { target: 'parameter' },
  mode: { target: 'parameter' },
  watermark: { target: 'parameter' },
  seed: { target: 'parameter' },
  element_list: { target: 'mediaField', field: 'element_list' },
}

// wan2.7 视频编辑（已在 seed 集的 wan27-i2v 文件之外，这里补 edit）
export const wan27VideoEdit: ModelConfig = {
  id: 'wan27-video-edit', model: 'wan2.7-videoedit', supportedModels: ['wan2.7-videoedit'],
  displayName: '万相2.7 视频编辑', category: 'video', subCategory: 'video-editing',
  endpoint: EP, async: true, refSyntax: 'cn-prefixed',
  pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers: [{ condition: { resolution: '720P' }, price: 0.6 }, { condition: { resolution: '1080P' }, price: 1.0 }] },
  requestType: 'video-media', referenceMediaType: 'reference_image',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '用 图N/视频N 指代参考素材' },
    { name: 'media', label: '编辑素材', type: 'media', required: true, description: '待编辑视频 + 参考图片', mediaSlots: [{ type: 'video', label: '待编辑视频', accept: 'video/*', maxCount: 1, maxSizeMB: 100 }, { type: 'reference_image', label: '参考图片', accept: 'image/*', maxCount: 4, maxSizeMB: 20 }] },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1080P', options: [{ label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 5, max: 10 },
    watermarkAI, seed,
  ],
  inputMapping: EDIT_MAP,
}

export const happyhorseVideoEdit: ModelConfig = {
  id: 'happyhorse-video-edit', model: 'happyhorse-1.0-video-edit', supportedModels: ['happyhorse-1.0-video-edit'],
  displayName: 'HappyHorse 视频编辑', category: 'video', subCategory: 'video-editing',
  endpoint: EP, async: true, refSyntax: 'bracket-en',
  pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers: [{ condition: { resolution: '720P' }, price: 0.9 }, { condition: { resolution: '1080P' }, price: 1.6 }] },
  requestType: 'video-media', referenceMediaType: 'reference_image',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '用 [Image N] 指代参考图片' },
    { name: 'media', label: '编辑素材', type: 'media', required: true, description: '待编辑视频 + 参考图片', mediaSlots: [{ type: 'video', label: '待编辑视频', accept: 'video/*', maxCount: 1, maxSizeMB: 100 }, { type: 'reference_image', label: '参考图片', accept: 'image/*', maxCount: 5, maxSizeMB: 20 }] },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1080P', options: [{ label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 3, max: 15 },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: true, description: '文案 "Happy Horse"' },
    seed,
  ],
  inputMapping: EDIT_MAP,
}

export const klingV3OmniVideoEdit: ModelConfig = {
  id: 'kling-v3-omni-video-edit', model: 'kling/kling-v3-omni-video-generation', supportedModels: ['kling/kling-v3-omni-video-generation'],
  displayName: '可灵 V3 Omni 视频编辑', category: 'video', subCategory: 'video-editing',
  endpoint: EP, async: true,
  pricing: { unit: 'per_second', quantityKey: 'duration', region: 'cn-beijing', tiers: [{ condition: { mode: 'std' }, price: 0.6 }, { condition: { mode: 'pro' }, price: 0.8 }] },
  requestType: 'video-media', referenceMediaType: 'refer',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 2500, description: 'Omni 支持 <<<element_N>>> 语法引用主体' },
    { name: 'media', label: '编辑素材', type: 'media', required: true, description: 'base 视频 + refer 图片', mediaSlots: [{ type: 'base', label: '待编辑视频', accept: 'video/*', maxCount: 1, maxSizeMB: 100 }, { type: 'refer', label: '参考图片', accept: 'image/*', maxCount: 4, maxSizeMB: 10 }] },
    { name: 'element_list', label: '主体列表', type: 'multi-text', description: 'JSON 数组 [{element_id: number}]' },
    { name: 'mode', label: '生成模式', type: 'select', defaultValue: 'pro', options: [{ label: '专业版 (1080P)', value: 'pro' }, { label: '标准版 (720P)', value: 'std' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 3, max: 15 },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '文案 "可灵AI"' },
  ],
  inputMapping: EDIT_MAP,
}
