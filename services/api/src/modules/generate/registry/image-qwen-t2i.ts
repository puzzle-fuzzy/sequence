import type { ModelConfig } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// 千问 文生图 (image, 同步)
// 对应 v1: packages/bailian/src/image/models/qwen-t2i.ts
// API: POST /services/aigc/multimodal-generation/generation (同步，Chat 风格)
// ---------------------------------------------------------------------------

export const qwenTextToImage: ModelConfig = {
  id: 'qwen-text-to-image',
  model: 'qwen-image-2.0-pro',
  supportedModels: ['qwen-image-2.0-pro', 'qwen-image-2.0', 'qwen-image-max', 'qwen-image-plus', 'qwen-image'],
  displayName: '千问 文生图',
  category: 'image',
  subCategory: 'text-to-image',
  endpoint: '/services/aigc/multimodal-generation/generation',
  async: false,
  pricing: {
    unit: 'per_image',
    quantityKey: 'n',
    region: 'cn-beijing',
    tiers: [{ condition: {}, price: 0.5 }],
  },
  requestType: 'image',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000, description: '描述期望生成的图像内容、风格和构图' },
    { name: 'negative_prompt', label: '反向提示词', type: 'text', maxLength: 500, description: '描述不希望在图像中出现的内容' },
    { name: 'size', label: '输出分辨率', type: 'select', defaultValue: '2048*2048', options: [
      { label: '1:1　2048×2048', value: '2048*2048' },
      { label: '1:1　1024×1024', value: '1024*1024' },
      { label: '16:9　1920×1080', value: '1920*1080' },
      { label: '9:16　1080×1920', value: '1080*1920' },
      { label: '3:2　1536×1024', value: '1536*1024' },
      { label: '2:3　1024×1536', value: '1024*1536' },
    ], description: '输出图像分辨率' },
    { name: 'n', label: '生成张数', type: 'number', defaultValue: 1, min: 1, max: 6, description: '2.0系列 1-6张；max/plus系列固定1' },
    { name: 'prompt_extend', label: 'Prompt 智能改写', type: 'boolean', defaultValue: true },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '添加 "Qwen-Image" 水印' },
    { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647 },
  ],
  inputMapping: {
    prompt: { target: 'prompt' },
    negative_prompt: { target: 'parameter' },
    size: { target: 'parameter' },
    n: { target: 'parameter' },
    prompt_extend: { target: 'parameter' },
    watermark: { target: 'parameter' },
    seed: { target: 'parameter' },
  },
}
