import type { ModelConfig } from '@seq/bailian-core'

// ---------------------------------------------------------------------------
// Fun-Music 音乐生成 (audio, 同步)
// 对应 v1: packages/bailian/src/music/models/fun-music.ts
// API: POST /services/audio/music/generation (同步，所有字段在 input 层，无 parameters 包裹)
// ---------------------------------------------------------------------------

export const funMusicV1: ModelConfig = {
  id: 'fun-music-v1',
  model: 'fun-music-v1',
  supportedModels: ['fun-music-v1', 'fun-music-preview'],
  displayName: 'Fun-Music 音乐生成',
  category: 'audio',
  subCategory: 'text-to-music',
  endpoint: '/services/audio/music/generation',
  async: false,
  pricing: {
    unit: 'per_audio',
    quantityKey: 'duration',
    region: 'cn-beijing',
    tiers: [{ condition: {}, price: 0.1 }],
  },
  requestType: 'audio',
  parameters: [
    { name: 'prompt', label: '音乐描述', type: 'text', maxLength: 500, description: '描述期望的音乐风格、情绪和场景。与 lyrics 二选一' },
    { name: 'lyrics', label: '歌词', type: 'text', maxLength: 2000, description: '歌词内容。与 prompt 二选一' },
    { name: 'gender', label: '演唱声音', type: 'select', defaultValue: 'female', options: [{ label: '女声', value: 'female' }, { label: '男声', value: 'male' }] },
    { name: 'format', label: '音频格式', type: 'select', defaultValue: 'mp3', options: [{ label: 'MP3', value: 'mp3' }, { label: 'WAV', value: 'wav' }] },
    { name: 'enable_aigc_watermark', label: 'AIGC 水印', type: 'boolean', defaultValue: false, description: '在音频末尾追加标识为 AI 生成的信号' },
  ],
  // audio requestType：所有字段平铺到 input 层（无 parameters 包裹），故全用 mediaField
  inputMapping: {
    prompt: { target: 'prompt' },
    lyrics: { target: 'mediaField', field: 'lyrics' },
    gender: { target: 'mediaField', field: 'gender' },
    format: { target: 'mediaField', field: 'format' },
    enable_aigc_watermark: { target: 'mediaField', field: 'enable_aigc_watermark' },
  },
}
