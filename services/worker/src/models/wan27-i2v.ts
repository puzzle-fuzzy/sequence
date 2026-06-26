import type { ModelConfig } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// 万相2.7 图生视频 (video-media) — 含 media 槽位 (first_frame/last_frame/driving_audio/first_clip)
// 对应 v1: packages/bailian/src/video/models/wan2.7-i2v.ts
// ---------------------------------------------------------------------------

export const wan27I2v: ModelConfig = {
  id: 'wan27-i2v',
  model: 'wan2.7-i2v-2026-04-25',
  supportedModels: ['wan2.7-i2v-2026-04-25'],
  displayName: '万相 2.7 图生视频',
  category: 'video',
  subCategory: 'image-to-video',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: {
    unit: 'per_second',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [
      { condition: { resolution: '720P' }, price: 0.6 },
      { condition: { resolution: '1080P' }, price: 1.0 },
    ],
  },
  requestType: 'video-media',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', maxLength: 5000, description: '描述期望生成的视频内容，可选' },
    { name: 'negative_prompt', label: '反向提示词', type: 'text', maxLength: 500 },
    {
      name: 'media',
      label: '媒体素材',
      type: 'media',
      required: true,
      description: '支持首帧生视频 / 首尾帧生视频 / 视频续写三种模式',
      mediaSlots: [
        { type: 'first_frame', label: '首帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 20 },
        { type: 'last_frame', label: '尾帧图片', accept: 'image/*', maxCount: 1, maxSizeMB: 20 },
        { type: 'driving_audio', label: '驱动音频', accept: 'audio/*', maxCount: 1, maxSizeMB: 15 },
        { type: 'first_clip', label: '首段视频', accept: 'video/*', maxCount: 1, maxSizeMB: 100 },
      ],
    },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1080P', options: [{ label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
    { name: 'ratio', label: '宽高比', type: 'select', defaultValue: '16:9', options: [{ label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' }, { label: '1:1', value: '1:1' }, { label: '4:3', value: '4:3' }, { label: '3:4', value: '3:4' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 2, max: 15 },
    { name: 'prompt_extend', label: 'Prompt 智能改写', type: 'boolean', defaultValue: true },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false },
  ],
  // media 字段：前端按 mediaSlots 收集为 media[{type,url}]；这里 media 参数整体映射到 input.media
  inputMapping: {
    prompt: { target: 'prompt' },
    negative_prompt: { target: 'mediaField', field: 'negative_prompt' },
    media: { target: 'media', mediaType: 'first_frame' },
    resolution: { target: 'parameter' },
    ratio: { target: 'parameter' },
    duration: { target: 'parameter' },
    prompt_extend: { target: 'parameter' },
    watermark: { target: 'parameter' },
  },
}
