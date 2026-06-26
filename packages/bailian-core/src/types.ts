import type { ModelCategory } from '@seq/shared'

// ---------------------------------------------------------------------------
// 模型参数 — 驱动前端表单渲染 + 校验 + 请求体映射
// ---------------------------------------------------------------------------

/** 表单控件类型（前端据此渲染组件） */
export type ParameterType =
  | 'text'
  | 'number'
  | 'select'
  | 'boolean'
  | 'media'
  | 'multi-text'
  | 'color-palette'
  | 'shot-list'

/** 单个参数的运行时元数据 */
export interface ModelParameter {
  /** API 参数名 / 用户参数 key */
  name: string
  /** 前端表单 label */
  label: string
  /** 控件类型 */
  type: ParameterType
  /** 补充说明（tooltip） */
  description?: string
  /** 是否必填 */
  required?: boolean
  /** 默认值 */
  defaultValue?: unknown
  // --- select 专有 ---
  options?: Array<{ label: string; value: unknown }>
  // --- number 专有 ---
  min?: number
  max?: number
  // --- text 专有 ---
  maxLength?: number
  // --- media 专有 ---
  /** 媒体槽位配置（type='media' 时）。每个 slot 对应 input.media[] 或 input[<field>] 的一个位置 */
  mediaSlots?: Array<{
    type: string
    label: string
    accept: string
    maxCount?: number
    maxSizeMB?: number
  }>
}

// ---------------------------------------------------------------------------
// 参数 → 请求体映射（判别联合，消除 v1 的字符串判分支）
// ---------------------------------------------------------------------------

/**
 * @seq/bailian-client 的 buildRequestBody 遍历此表分发，无 model-name 分支。
 *   prompt     → input.prompt
 *   media      → input.media[{type, url}]
 *   mediaField → input[<field>]
 *   parameter  → parameters[<field ?? paramName>]（field 省略时用参数名，设置时为别名，如 PixVerse resolution→size）
 *   ignored    → 跳过（UI-only）
 */
export type InputMapping =
  | { target: 'prompt' }
  | { target: 'media'; mediaType: string }
  | { target: 'mediaField'; field: string }
  | { target: 'parameter'; field?: string }
  | { target: 'ignored' }

/** 请求体形状 — 决定客户端如何塑形 request body */
export type RequestType =
  | 'chat'
  | 'image' // messages 结构（multimodal-generation 同步 / image-generation 异步，端点差异由 ModelConfig.endpoint+async 表达）
  | 'image2image' // flat input（image2image/image-synthesis，如 qwen-mt-image）
  | 'video-t2v'
  | 'video-media'
  | 'audio'

// ---------------------------------------------------------------------------
// 定价
// ---------------------------------------------------------------------------

export type PricingUnit = 'per_token' | 'per_image' | 'per_second' | 'per_audio'

/** 价格档位：按某参数维度（如 resolution）匹配不同单价 */
export interface PriceTier {
  /** 匹配条件，如 { resolution: '720P' }。空对象表示统一价 */
  condition: Record<string, unknown>
  /** 单价（元） */
  price: number
}

export interface ModelPricing {
  unit: PricingUnit
  /** 价格档位列表。第一个为默认（兜底）档位 */
  tiers: PriceTier[]
  /** 决定总价乘数的参数字段 key（视频→duration，图像→n） */
  quantityKey: string
  /** 地域，默认 cn-beijing */
  region?: string
}

// ---------------------------------------------------------------------------
// 模型完整定义
// ---------------------------------------------------------------------------

export interface ModelConfig {
  /** 前端唯一标识，不与 API 模型 ID 耦合 */
  id: string
  /** API 调用时的模型标识，如 'wan2.7-t2v' */
  model: string
  /** 该模型支持的所有版本（API model id 列表） */
  supportedModels: string[]
  /** 前端展示名称 */
  displayName: string
  /** 大类 */
  category: ModelCategory
  /** 小类（自由字符串，如 'text-to-video'） */
  subCategory: string
  /** 有序参数列表，前端按数组顺序渲染 */
  parameters: ModelParameter[]
  /** 创建任务的 API 路径（相对 baseUrl），如 '/services/aigc/video-generation/video-synthesis' */
  endpoint: string
  /** 是否异步 API（创建任务 → 轮询结果）。false 表示同步返回结果 */
  async: boolean
  /** 定价信息 */
  pricing: ModelPricing
  /** 请求体形状。决定 bailian-client 如何组装 request body */
  requestType: RequestType
  /** 每个参数 → 请求体的映射。key = ModelParameter.name */
  inputMapping: Record<string, InputMapping>
  /** referenceUrls 数组映射到 input.media[] 时使用的 type（仅 r2v 等模型） */
  referenceMediaType?: string
  /** 失败时的降级模型 ID（如 r2v → t2v），可选 */
  fallbackModel?: string
  /** prompt 中参考素材的引用语法风格（决定 chip 序列化） */
  refSyntax?: 'bracket-en' | 'cn-prefixed'
}
