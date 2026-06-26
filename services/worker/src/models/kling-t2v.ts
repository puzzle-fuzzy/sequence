import type { ModelConfig } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// 可灵 (Kling) 文生视频 (video-t2v) — V3 / V3 Omni 两个变体
// 对应 v1: packages/bailian/src/video/models/kling-t2v.ts
// 使用 mode（pro/std）代替 resolution，aspect_ratio 代替 ratio。
// 支持智能分镜（multi_shot + shot_type + multi_prompt shot-list）。
// Omni 支持 <<<element_N>>> 语法引用主体。
// ---------------------------------------------------------------------------

const KLING_T2V_MAPPING: ModelConfig['inputMapping'] = {
  prompt: { target: 'prompt' },
  mode: { target: 'parameter' },
  aspect_ratio: { target: 'parameter' },
  duration: { target: 'parameter' },
  audio: { target: 'parameter' },
  multi_shot: { target: 'mediaField', field: 'multi_shot' },
  shot_type: { target: 'mediaField', field: 'shot_type' },
  multi_prompt: { target: 'mediaField', field: 'multi_prompt' },
  watermark: { target: 'parameter' },
}

const KLING_T2V_FIELDS: ModelConfig['parameters'] = [
  { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 2500, description: '描述期望生成的视频内容。支持中英文，不超过2500个字符' },
  { name: 'mode', label: '生成模式', type: 'select', defaultValue: 'pro', options: [{ label: '专业版 (1080P)', value: 'pro' }, { label: '标准版 (720P)', value: 'std' }], description: 'pro=1080P 专业品质，std=720P 标准品质。影响价格' },
  { name: 'aspect_ratio', label: '宽高比', type: 'select', defaultValue: '16:9', options: [{ label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' }, { label: '1:1', value: '1:1' }] },
  { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 3, max: 15, description: '单位：秒，取值范围 [3, 15]' },
  { name: 'audio', label: '生成音频', type: 'boolean', defaultValue: false, description: '是否生成背景音乐和音效。有声视频价格高于无声视频' },
  { name: 'multi_shot', label: '智能分镜', type: 'boolean', defaultValue: false, description: '开启后启用多镜头生成。智能模式由模型自动规划镜头；自定义模式支持独立控制每个片段的提示词和时长' },
  { name: 'shot_type', label: '分镜模式', type: 'select', defaultValue: 'intelligence', options: [{ label: '智能分镜（模型自动规划）', value: 'intelligence' }, { label: '自定义分镜（手动设置每镜）', value: 'customize' }], description: '仅当智能分镜开启时生效' },
  { name: 'multi_prompt', label: '分镜脚本', type: 'shot-list', min: 1, max: 6, description: '自定义每个分镜片段的提示词与时长。1~6 个片段，每个时长 1~15 秒。仅当分镜模式为"自定义"时生效' },
  { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '水印位于视频右下角，文案为 "可灵AI"' },
]

export const klingV3T2v: ModelConfig = {
  id: 'kling-v3-t2v',
  model: 'kling/kling-v3-video-generation',
  supportedModels: ['kling/kling-v3-video-generation'],
  displayName: '可灵 V3 文生视频',
  category: 'video',
  subCategory: 'text-to-video',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: {
    unit: 'per_second',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [
      { condition: { mode: 'std' }, price: 0.6 },
      { condition: { mode: 'pro' }, price: 0.8 },
    ],
  },
  requestType: 'video-t2v',
  parameters: KLING_T2V_FIELDS,
  inputMapping: KLING_T2V_MAPPING,
}

export const klingV3OmniT2v: ModelConfig = {
  id: 'kling-v3-omni-t2v',
  model: 'kling/kling-v3-omni-video-generation',
  supportedModels: ['kling/kling-v3-omni-video-generation'],
  displayName: '可灵 V3 Omni 文生视频',
  category: 'video',
  subCategory: 'text-to-video',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: {
    unit: 'per_second',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [
      { condition: { mode: 'std' }, price: 0.6 },
      { condition: { mode: 'pro' }, price: 0.8 },
    ],
  },
  requestType: 'video-t2v',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 2500, description: '描述期望生成的视频内容。支持中英文，不超过2500个字符。Omni 模型支持 <<<element_N>>> 语法引用主体' },
    ...KLING_T2V_FIELDS.slice(1),
  ],
  inputMapping: KLING_T2V_MAPPING,
}
