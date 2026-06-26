import type { ModelConfig } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// PixVerse（爱诗）文生视频 (video-t2v) — C1 / V6 / V5.6 三个变体
// 对应 v1: packages/bailian/src/video/models/pixverse-t2v.ts
// 使用 parameter alias：resolution 参数 → API 的 size 字段（像素值如 1280*720）
// V6 支持 shot_type（多镜头智能分镜）
// ---------------------------------------------------------------------------

const SIZE_OPTIONS_T2V = [
  { label: '360P 16:9 (640*360)', value: '640*360' },
  { label: '360P 9:16 (360*640)', value: '360*640' },
  { label: '360P 1:1 (640*640)', value: '640*640' },
  { label: '540P 16:9 (1024*576)', value: '1024*576' },
  { label: '540P 9:16 (576*1024)', value: '576*1024' },
  { label: '540P 1:1 (1024*1024)', value: '1024*1024' },
  { label: '720P 16:9 (1280*720)', value: '1280*720' },
  { label: '720P 9:16 (720*1280)', value: '720*1280' },
  { label: '720P 1:1 (960*960)', value: '960*960' },
  { label: '1080P 16:9 (1920*1080)', value: '1920*1080' },
  { label: '1080P 9:16 (1080*1920)', value: '1080*1920' },
  { label: '1080P 1:1 (1440*1440)', value: '1440*1440' },
]

const PV_T2V_MAPPING: ModelConfig['inputMapping'] = {
  prompt: { target: 'prompt' },
  resolution: { target: 'parameter', field: 'size' }, // resolution → API size 别名
  duration: { target: 'parameter' },
  audio: { target: 'parameter' },
  watermark: { target: 'parameter' },
  seed: { target: 'parameter' },
  shot_type: { target: 'parameter' },
}

export const pixverseC1T2v: ModelConfig = {
  id: 'pixverse-c1-t2v',
  model: 'pixverse/pixverse-c1-t2v',
  supportedModels: ['pixverse/pixverse-c1-t2v'],
  displayName: 'PixVerse C1 文生视频',
  category: 'video',
  subCategory: 'text-to-video',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: {
    unit: 'per_second',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [
      { condition: { resolution: '640*360' }, price: 0.18 },
      { condition: { resolution: '1024*576' }, price: 0.24 },
      { condition: { resolution: '1280*720' }, price: 0.3 },
      { condition: { resolution: '1920*1080' }, price: 0.56 },
    ],
  },
  requestType: 'video-t2v',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '描述期望生成的视频内容。支持中英文，C1/V6 不超过5000字符，V5.6 不超过2048字符' },
    { name: 'resolution', label: '输出尺寸', type: 'select', required: true, defaultValue: '1280*720', options: SIZE_OPTIONS_T2V, description: '选择输出视频的像素尺寸与宽高比。映射为 API 的 size 参数' },
    { name: 'duration', label: '视频时长', type: 'number', required: true, defaultValue: 5, min: 1, max: 15, description: '单位：秒' },
    { name: 'audio', label: '生成音频', type: 'boolean', defaultValue: false, description: '是否生成背景音乐和音效。有声视频价格高于无声视频' },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '水印位于视频右下角，文案为 "AI生成"' },
    { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647, description: '固定种子可提升结果可复现性。留空则系统自动生成随机种子' },
  ],
  inputMapping: PV_T2V_MAPPING,
}

export const pixverseV6T2v: ModelConfig = {
  id: 'pixverse-v6-t2v',
  model: 'pixverse/pixverse-v6-t2v',
  supportedModels: ['pixverse/pixverse-v6-t2v'],
  displayName: 'PixVerse V6 文生视频',
  category: 'video',
  subCategory: 'text-to-video',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: {
    unit: 'per_second',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [
      { condition: { resolution: '640*360' }, price: 0.15 },
      { condition: { resolution: '1024*576' }, price: 0.21 },
      { condition: { resolution: '1280*720' }, price: 0.27 },
      { condition: { resolution: '1920*1080' }, price: 0.53 },
    ],
  },
  requestType: 'video-t2v',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '描述期望生成的视频内容。支持中英文，不超过5000字符' },
    { name: 'resolution', label: '输出尺寸', type: 'select', required: true, defaultValue: '1280*720', options: SIZE_OPTIONS_T2V, description: '选择输出视频的像素尺寸与宽高比。映射为 API 的 size 参数' },
    { name: 'duration', label: '视频时长', type: 'number', required: true, defaultValue: 5, min: 1, max: 15, description: '单位：秒' },
    { name: 'audio', label: '生成音频', type: 'boolean', defaultValue: false, description: '是否生成背景音乐和音效' },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '水印位于视频右下角，文案为 "AI生成"' },
    { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647, description: '固定种子可提升结果可复现性' },
    { name: 'shot_type', label: '镜头模式', type: 'select', defaultValue: 'single', options: [{ label: '单镜头', value: 'single' }, { label: '多镜头/智能分镜', value: 'multi' }], description: 'V6 支持多镜头智能分镜，可生成含有多个场景切换的视频' },
  ],
  inputMapping: PV_T2V_MAPPING,
}

export const pixverseV56T2v: ModelConfig = {
  id: 'pixverse-v56-t2v',
  model: 'pixverse/pixverse-v5.6-t2v',
  supportedModels: ['pixverse/pixverse-v5.6-t2v'],
  displayName: 'PixVerse V5.6 文生视频',
  category: 'video',
  subCategory: 'text-to-video',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: {
    unit: 'per_second',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [
      { condition: { resolution: '640*360' }, price: 0.21 },
      { condition: { resolution: '1024*576' }, price: 0.21 },
      { condition: { resolution: '1280*720' }, price: 0.27 },
      { condition: { resolution: '1920*1080' }, price: 0.44 },
    ],
  },
  requestType: 'video-t2v',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 2048, description: '描述期望生成的视频内容。不超过2048字符' },
    { name: 'resolution', label: '输出尺寸', type: 'select', required: true, defaultValue: '1280*720', options: SIZE_OPTIONS_T2V, description: '选择输出视频的像素尺寸与宽高比。映射为 API 的 size 参数' },
    { name: 'duration', label: '视频时长', type: 'number', required: true, defaultValue: 5, min: 1, max: 15, description: '单位：秒。360P/540P/720P 可选择 5/8/10s，1080P 可选择 5/8s' },
    { name: 'audio', label: '生成音频', type: 'boolean', defaultValue: false, description: '是否生成背景音乐和音效' },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '水印位于视频右下角，文案为 "AI生成"' },
    { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647, description: '固定种子可提升结果可复现性' },
  ],
  inputMapping: PV_T2V_MAPPING,
}
