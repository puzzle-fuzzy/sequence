import type { ModelConfig } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// 万相2.7 参考生视频 (video-media + referenceMediaType)
// 对应 v1: packages/bailian/src/video/models/wan2.7-r2v.ts
// referenceUrls → input.media[]，type=reference_image
// ---------------------------------------------------------------------------

export const wan27R2v: ModelConfig = {
  id: 'wan27-r2v',
  model: 'wan2.7-r2v',
  supportedModels: ['wan2.7-r2v'],
  displayName: '万相 2.7 参考生视频',
  category: 'video',
  subCategory: 'reference-to-video',
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
  referenceMediaType: 'reference_image',
  refSyntax: 'cn-prefixed',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '用「图1/图2」指代参考图像，「视频1/视频2」指代参考视频' },
    { name: 'negative_prompt', label: '反向提示词', type: 'text', maxLength: 500 },
    {
      name: 'media',
      label: '参考素材',
      type: 'media',
      required: true,
      description: '参考图片/视频（1-3 张）',
      mediaSlots: [{ type: 'reference_image', label: '参考图片', accept: 'image/*', maxCount: 3, maxSizeMB: 20 }],
    },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1080P', options: [{ label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
    { name: 'ratio', label: '宽高比', type: 'select', defaultValue: '16:9', options: [{ label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' }, { label: '1:1', value: '1:1' }, { label: '4:3', value: '4:3' }, { label: '3:4', value: '3:4' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 5, max: 10 },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false },
  ],
  // media 参数显式提供时进 input.media；referenceUrls 路径走 buildRequestBody 的 referenceMediaType 分支
  inputMapping: {
    prompt: { target: 'prompt' },
    negative_prompt: { target: 'mediaField', field: 'negative_prompt' },
    media: { target: 'media', mediaType: 'reference_image' },
    resolution: { target: 'parameter' },
    ratio: { target: 'parameter' },
    duration: { target: 'parameter' },
    watermark: { target: 'parameter' },
  },
}
