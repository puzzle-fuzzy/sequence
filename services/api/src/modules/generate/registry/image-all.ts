import type { ModelConfig, InputMapping } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// image 全系列（7 个模型）
// - kling-image ×2：image-generation 端点（异步），messages 结构 = image requestType
// - wan2.7-image ×2：multimodal 端点（同步），messages 结构 = image requestType
// - z-image：multimodal 端点（同步）
// - qwen-image-edit：multimodal 端点（同步），messages + media
// - qwen-mt-image：image2image 端点（异步），flat input = image2image requestType
// ---------------------------------------------------------------------------

// ---- 可灵 图像生成（异步，image-generation 端点，messages 结构）----
const KLING_IMG_MAP: Record<string, InputMapping> = {
  prompt: { target: 'prompt' },
  n: { target: 'parameter' },
  aspect_ratio: { target: 'parameter' },
  resolution: { target: 'parameter' },
  watermark: { target: 'parameter' },
}
export const klingImageGen: ModelConfig = {
  id: 'kling-image-gen', model: 'kling/kling-v3-image-generation', supportedModels: ['kling/kling-v3-image-generation'],
  displayName: '可灵 图像生成', category: 'image', subCategory: 'text-to-image',
  endpoint: '/services/aigc/image-generation/generation', async: true,
  pricing: { unit: 'per_image', quantityKey: 'n', region: 'cn-beijing', tiers: [{ condition: {}, price: 0.5 }] },
  requestType: 'image',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 2500, description: '描述期望生成的图像内容' },
    { name: 'n', label: '生成张数', type: 'number', defaultValue: 1, min: 1, max: 9 },
    { name: 'aspect_ratio', label: '宽高比', type: 'select', defaultValue: '16:9', options: [{ label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' }, { label: '1:1', value: '1:1' }] },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1k', options: [{ label: '1K', value: '1k' }, { label: '2K', value: '2k' }] },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '文案 "可灵AI"' },
  ],
  inputMapping: KLING_IMG_MAP,
}
export const klingOmniImageGen: ModelConfig = {
  id: 'kling-omni-image-gen', model: 'kling/kling-v3-omni-image-generation', supportedModels: ['kling/kling-v3-omni-image-generation'],
  displayName: '可灵 全能图像生成', category: 'image', subCategory: 'text-to-image',
  endpoint: '/services/aigc/image-generation/generation', async: true,
  pricing: { unit: 'per_image', quantityKey: 'n', region: 'cn-beijing', tiers: [{ condition: {}, price: 0.6 }] },
  requestType: 'image',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 2500 },
    { name: 'n', label: '生成张数', type: 'number', defaultValue: 1, min: 1, max: 9 },
    { name: 'aspect_ratio', label: '宽高比', type: 'select', defaultValue: '16:9', options: [{ label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' }, { label: '1:1', value: '1:1' }] },
    { name: 'resolution', label: '分辨率', type: 'select', defaultValue: '1k', options: [{ label: '1K', value: '1k' }, { label: '2K', value: '2k' }, { label: '4K', value: '4k' }] },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '文案 "可灵AI"' },
  ],
  inputMapping: KLING_IMG_MAP,
}

// ---- 万相 图像生成（同步，multimodal 端点）----
const WAN_IMG_MAP: Record<string, InputMapping> = {
  prompt: { target: 'prompt' },
  size: { target: 'parameter' },
  n: { target: 'parameter' },
  thinking_mode: { target: 'parameter' },
  enable_sequential: { target: 'parameter' },
  color_palette: { target: 'parameter' },
  watermark: { target: 'parameter' },
  seed: { target: 'parameter' },
}
const wanImgBase = (id: string, model: string, displayName: string, price: number, support4k: boolean): ModelConfig => ({
  id, model, supportedModels: [model], displayName, category: 'image', subCategory: 'text-to-image',
  endpoint: '/services/aigc/multimodal-generation/generation', async: false,
  pricing: { unit: 'per_image', quantityKey: 'n', region: 'cn-beijing', tiers: [{ condition: {}, price }] },
  requestType: 'image',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000 },
    { name: 'size', label: '输出分辨率', type: 'select', defaultValue: '2K', options: support4k ? [{ label: '1K', value: '1K' }, { label: '2K', value: '2K' }, { label: '4K', value: '4K' }] : [{ label: '1K', value: '1K' }, { label: '2K', value: '2K' }] },
    { name: 'n', label: '生成张数', type: 'number', defaultValue: 1, min: 1, max: 4 },
    { name: 'thinking_mode', label: '思考模式', type: 'boolean', defaultValue: true, description: '开启后增强推理能力提升出图质量' },
    { name: 'enable_sequential', label: '组图模式', type: 'boolean', defaultValue: false, description: '开启组图输出' },
    { name: 'color_palette', label: '自定义颜色主题', type: 'color-palette', description: '3-10 种颜色 {hex, ratio}，ratio 总和须 100%' },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false, description: '文案 "AI生成"' },
    { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647 },
  ],
  inputMapping: WAN_IMG_MAP,
})
export const wan27ImagePro = wanImgBase('wan27-image-pro', 'wan2.7-image-pro', '万相2.7 图像生成 Pro', 0.4, true)
export const wan27Image = wanImgBase('wan27-image', 'wan2.7-image', '万相2.7 图像生成', 0.3, false)

// ---- Z-Image 轻量文生图（同步，multimodal）----
export const zImageTurbo: ModelConfig = {
  id: 'z-image-turbo', model: 'z-image-turbo', supportedModels: ['z-image-turbo'],
  displayName: 'Z-Image 轻量文生图', category: 'image', subCategory: 'text-to-image',
  endpoint: '/services/aigc/multimodal-generation/generation', async: false,
  pricing: { unit: 'per_image', quantityKey: 'n', region: 'cn-beijing', tiers: [{ condition: {}, price: 0.1 }] },
  requestType: 'image',
  parameters: [
    { name: 'prompt', label: '文本提示词', type: 'text', required: true, maxLength: 5000 },
    { name: 'size', label: '输出尺寸', type: 'text', defaultValue: '1024*1024', description: '宽*高 像素值，总像素 512*512~2048*2048' },
    { name: 'prompt_extend', label: 'Prompt 智能改写', type: 'boolean', defaultValue: true },
    { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647 },
  ],
  inputMapping: { prompt: { target: 'prompt' }, size: { target: 'parameter' }, prompt_extend: { target: 'parameter' }, seed: { target: 'parameter' } },
}

// ---- 千问 图像编辑（同步，multimodal，messages + media）----
export const qwenImageEdit: ModelConfig = {
  id: 'qwen-image-edit', model: 'qwen-image-2.0-pro', supportedModels: ['qwen-image-2.0-pro', 'qwen-image-2.0', 'qwen-image-max', 'qwen-image-plus', 'qwen-image'],
  displayName: '千问 图像编辑', category: 'image', subCategory: 'image-to-image',
  endpoint: '/services/aigc/multimodal-generation/generation', async: false,
  pricing: { unit: 'per_image', quantityKey: 'n', region: 'cn-beijing', tiers: [{ condition: {}, price: 0.5 }] },
  requestType: 'image',
  parameters: [
    { name: 'media', label: '输入图像', type: 'media', required: true, description: '输入图像（1-3 张）。格式：JPG/PNG/BMP/WEBP，不超过 10MB', mediaSlots: [{ type: 'reference_image', label: '输入图像', accept: 'image/*', maxCount: 3, maxSizeMB: 10 }] },
    { name: 'prompt', label: '编辑指令', type: 'text', required: true, maxLength: 1300, description: '描述期望的编辑效果' },
    { name: 'n', label: '生成张数', type: 'number', defaultValue: 1, min: 1, max: 4 },
    { name: 'negative_prompt', label: '反向提示词', type: 'text', maxLength: 500 },
    { name: 'size', label: '输出分辨率', type: 'select', defaultValue: '2048*2048', options: [{ label: '2048×2048', value: '2048*2048' }, { label: '1024×1024', value: '1024*1024' }] },
    { name: 'prompt_extend', label: 'Prompt 智能改写', type: 'boolean', defaultValue: true },
    { name: 'watermark', label: '添加水印', type: 'boolean', defaultValue: false },
    { name: 'seed', label: '随机种子', type: 'number', min: 0, max: 2147483647 },
  ],
  // media → messages[].content[].image（image requestType 现在支持 media 合并）
  inputMapping: { media: { target: 'media', mediaType: 'reference_image' }, prompt: { target: 'prompt' }, n: { target: 'parameter' }, negative_prompt: { target: 'parameter' }, size: { target: 'parameter' }, prompt_extend: { target: 'parameter' }, watermark: { target: 'parameter' }, seed: { target: 'parameter' } },
}

// ---- 千问 图像翻译（异步，image2image 端点，flat input）----
export const qwenImageTranslation: ModelConfig = {
  id: 'qwen-image-translation', model: 'qwen-mt-image', supportedModels: ['qwen-mt-image'],
  displayName: '千问 图像翻译', category: 'image', subCategory: 'reference-to-image',
  endpoint: '/services/aigc/image2image/image-synthesis', async: true,
  pricing: { unit: 'per_image', quantityKey: 'n', region: 'cn-beijing', tiers: [{ condition: {}, price: 0.003 }] },
  requestType: 'image2image',
  parameters: [
    { name: 'image_url', label: '图像 URL', type: 'text', required: true, description: '图像的公网可访问 URL。JPG/JPEG/PNG/BMP/WEBP，15-8192px，不超过 100MB' },
    { name: 'source_lang', label: '源语种', type: 'select', required: true, defaultValue: 'auto', options: [{ label: '自动检测', value: 'auto' }, { label: '中文', value: 'zh' }, { label: '英文', value: 'en' }, { label: '日语', value: 'ja' }, { label: '韩语', value: 'ko' }, { label: '俄语', value: 'ru' }, { label: '西班牙语', value: 'es' }, { label: '法语', value: 'fr' }] },
    { name: 'target_lang', label: '目标语种', type: 'select', required: true, defaultValue: 'en', options: [{ label: '中文', value: 'zh' }, { label: '英文', value: 'en' }, { label: '日语', value: 'ja' }, { label: '韩语', value: 'ko' }, { label: '俄语', value: 'ru' }, { label: '西班牙语', value: 'es' }, { label: '法语', value: 'fr' }, { label: '葡萄牙语', value: 'pt' }, { label: '意大利语', value: 'it' }, { label: '越南语', value: 'vi' }, { label: '马来语', value: 'ms' }, { label: '泰语', value: 'th' }, { label: '印尼语', value: 'id' }, { label: '阿拉伯语', value: 'ar' }] },
    { name: 'domainHint', label: '领域提示', type: 'text', description: '英文描述使用场景/译文风格，不超过 200 单词' },
    { name: 'imageSegment', label: '图像主体分割', type: 'boolean', defaultValue: false, description: '开启后不翻译主体（人物/商品/Logo）上的文字' },
  ],
  inputMapping: {
    image_url: { target: 'mediaField', field: 'image_url' },
    source_lang: { target: 'mediaField', field: 'source_lang' },
    target_lang: { target: 'mediaField', field: 'target_lang' },
    domainHint: { target: 'mediaField', field: 'domainHint' },
    imageSegment: { target: 'mediaField', field: 'imageSegment' },
  },
}
