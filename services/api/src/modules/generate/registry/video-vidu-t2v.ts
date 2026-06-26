import type { ModelConfig } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// Vidu 文生视频 (video-t2v) — Q3 Pro / Q3 Turbo / Q2 三个变体
// 对应 v1: packages/bailian/src/video/models/vidu-t2v.ts
// Q3 系列支持 audio + duration[1,16]；Q2 不支持 audio + duration[1,10]
// ---------------------------------------------------------------------------

const viduQ3Fields: ModelConfig['parameters'] = [
  { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '描述期望生成的视频内容。支持中英文，不超过5000个字符' },
  { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '720P', options: [{ label: '540P', value: '540P' }, { label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
  { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 1, max: 16, description: '单位：秒，取值范围 [1, 16]' },
  { name: 'audio', label: '生成音频', type: 'boolean', defaultValue: false, description: '是否生成背景音乐和音效（仅 Q3 系列支持）' },
  { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '水印位于视频右下角，文案为 "AI生成"' },
  { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647, description: '固定种子可提升结果可复现性。留空则系统自动生成随机种子' },
]

const viduQ3Mapping: ModelConfig['inputMapping'] = {
  prompt: { target: 'prompt' },
  resolution: { target: 'parameter' },
  duration: { target: 'parameter' },
  audio: { target: 'parameter' },
  watermark: { target: 'parameter' },
  seed: { target: 'parameter' },
}

export const viduQ3ProT2v: ModelConfig = {
  id: 'vidu-q3-pro-t2v',
  model: 'vidu/viduq3-pro_text2video',
  supportedModels: ['vidu/viduq3-pro_text2video'],
  displayName: 'Vidu Q3 Pro 文生视频',
  category: 'video',
  subCategory: 'text-to-video',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: {
    unit: 'per_second',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [
      { condition: { resolution: '540P' }, price: 0.3125 },
      { condition: { resolution: '720P' }, price: 0.78125 },
      { condition: { resolution: '1080P' }, price: 0.9375 },
    ],
  },
  requestType: 'video-t2v',
  parameters: viduQ3Fields,
  inputMapping: viduQ3Mapping,
}

export const viduQ3TurboT2v: ModelConfig = {
  id: 'vidu-q3-turbo-t2v',
  model: 'vidu/viduq3-turbo_text2video',
  supportedModels: ['vidu/viduq3-turbo_text2video'],
  displayName: 'Vidu Q3 Turbo 文生视频',
  category: 'video',
  subCategory: 'text-to-video',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: {
    unit: 'per_second',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [
      { condition: { resolution: '540P' }, price: 0.25 },
      { condition: { resolution: '720P' }, price: 0.375 },
      { condition: { resolution: '1080P' }, price: 0.4375 },
    ],
  },
  requestType: 'video-t2v',
  parameters: viduQ3Fields,
  inputMapping: viduQ3Mapping,
}

export const viduQ2T2v: ModelConfig = {
  id: 'vidu-q2-t2v',
  model: 'vidu/viduq2_text2video',
  supportedModels: ['vidu/viduq2_text2video'],
  displayName: 'Vidu Q2 文生视频',
  category: 'video',
  subCategory: 'text-to-video',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: {
    unit: 'per_second',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [
      { condition: { resolution: '540P' }, price: 0.1125 },
      { condition: { resolution: '720P' }, price: 0.21875 },
      { condition: { resolution: '1080P' }, price: 0.375 },
    ],
  },
  requestType: 'video-t2v',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '描述期望生成的视频内容。支持中英文，不超过5000个字符' },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '720P', options: [{ label: '540P', value: '540P' }, { label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 1, max: 10, description: '单位：秒，取值范围 [1, 10]' },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '水印位于视频右下角，文案为 "AI生成"' },
    { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647, description: '固定种子可提升结果可复现性。留空则系统自动生成随机种子' },
  ],
  inputMapping: {
    prompt: { target: 'prompt' },
    resolution: { target: 'parameter' },
    duration: { target: 'parameter' },
    watermark: { target: 'parameter' },
    seed: { target: 'parameter' },
  },
}
