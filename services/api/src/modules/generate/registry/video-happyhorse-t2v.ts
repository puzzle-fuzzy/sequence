import type { ModelConfig } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// HappyHorse 文生视频 (video-t2v)
// 对应 v1: packages/bailian/src/video/models/happyhorse-t2v.ts
// API: POST /services/aigc/video-generation/video-synthesis (异步)
// ---------------------------------------------------------------------------

export const happyhorseT2v: ModelConfig = {
  id: 'happyhorse-t2v',
  model: 'happyhorse-1.1-t2v',
  supportedModels: ['happyhorse-1.1-t2v', 'happyhorse-1.0-t2v'],
  displayName: 'HappyHorse 文生视频',
  category: 'video',
  subCategory: 'text-to-video',
  endpoint: '/services/aigc/video-generation/video-synthesis',
  async: true,
  pricing: {
    unit: 'per_second',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [
      { condition: { resolution: '720P' }, price: 0.9 },
      { condition: { resolution: '1080P' }, price: 1.2 },
    ],
  },
  requestType: 'video-t2v',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '描述期望生成的视频内容。支持任何语言，不超过5000个非中文字符或2500个中文字符' },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1080P', options: [{ label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
    { name: 'ratio', label: '宽高比', type: 'select', defaultValue: '16:9', options: [{ label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' }, { label: '1:1', value: '1:1' }, { label: '4:3', value: '4:3' }, { label: '3:4', value: '3:4' }, { label: '4:5', value: '4:5' }, { label: '5:4', value: '5:4' }, { label: '9:21', value: '9:21' }, { label: '21:9', value: '21:9' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 3, max: 15, description: '单位：秒，取值范围 [3, 15]' },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: true, description: '水印位于视频右下角，文案为 "Happy Horse"' },
    { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647, description: '固定种子可提升结果可复现性。留空则系统自动生成随机种子' },
  ],
  inputMapping: {
    prompt: { target: 'prompt' },
    resolution: { target: 'parameter' },
    ratio: { target: 'parameter' },
    duration: { target: 'parameter' },
    watermark: { target: 'parameter' },
    seed: { target: 'parameter' },
  },
}
