import type { ModelConfig } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// 万相2.7 文生视频 (video-t2v)
// 对应 v1: packages/bailian/src/video/models/wan2.7-t2v.ts
// API: POST /services/aigc/video-generation/video-synthesis (异步)
// ---------------------------------------------------------------------------

export const wan27T2v: ModelConfig = {
  id: 'wan27-t2v',
  model: 'wan2.7-t2v',
  supportedModels: ['wan2.7-t2v'],
  displayName: '万相 2.7 文生视频',
  category: 'video',
  subCategory: 'text-to-video',
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
  requestType: 'video-t2v',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '描述期望生成的视频内容。支持中英文，不超过5000个字符' },
    { name: 'negative_prompt', label: '反向提示词', type: 'text', maxLength: 500, description: '描述不希望在视频画面中看到的内容' },
    { name: 'audio_url', label: '音频文件 URL', type: 'text', description: '自定义音频文件链接。支持 wav/mp3，时长 2～30s，不超过 15MB' },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1080P', options: [{ label: '720P', value: '720P' }, { label: '1080P', value: '1080P' }] },
    { name: 'ratio', label: '宽高比', type: 'select', defaultValue: '16:9', options: [{ label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' }, { label: '1:1', value: '1:1' }, { label: '4:3', value: '4:3' }, { label: '3:4', value: '3:4' }] },
    { name: 'duration', label: '视频时长', type: 'number', defaultValue: 5, min: 2, max: 15, description: '单位：秒，取值范围 [2, 15]' },
    { name: 'prompt_extend', label: 'Prompt 智能改写', type: 'boolean', defaultValue: true, description: '开启后使用大模型对输入 prompt 进行智能改写' },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '水印位于视频右下角，文案为 "AI生成"' },
    { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647, description: '固定种子可提升结果可复现性。留空则系统自动生成' },
  ],
  // negative_prompt / audio_url 在 input 层；其余参数在 parameters 层
  inputMapping: {
    prompt: { target: 'prompt' },
    negative_prompt: { target: 'mediaField', field: 'negative_prompt' },
    audio_url: { target: 'mediaField', field: 'audio_url' },
    resolution: { target: 'parameter' },
    ratio: { target: 'parameter' },
    duration: { target: 'parameter' },
    prompt_extend: { target: 'parameter' },
    watermark: { target: 'parameter' },
    seed: { target: 'parameter' },
  },
}
