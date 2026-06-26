import type { ModelPricing } from './types'

/**
 * 计算预估价格（元）。
 * 1. 遍历 tiers，找第一个 condition 全匹配的档位（无匹配则用第一个兜底）
 * 2. 取 quantityKey（如 duration/n）作为乘数
 * 3. 单价 × 数量
 */
export function calcPrice(pricing: ModelPricing, params: Record<string, unknown>): number {
  const tier =
    pricing.tiers.find((t) =>
      Object.entries(t.condition).every(([k, v]) => params[k] === v),
    ) ?? pricing.tiers[0]
  if (!tier) return 0
  const raw = params[pricing.quantityKey]
  const quantity = typeof raw === 'number' ? raw : Number(raw) || 1
  return Math.round(tier.price * quantity * 10000) / 10000
}

/** 获取模型在默认档位下的单价。 */
export function getDefaultUnitPrice(pricing: ModelPricing): number {
  return pricing.tiers[0]?.price ?? 0
}
