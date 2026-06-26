import type { ModelConfig } from './types'

/**
 * 模型配置完整性自检 — 每个 required 参数必须在 inputMapping 中有映射。
 * 用于启动时 / 测试中校验 registry，防止「必填参数丢了请求体位置」的配置错误。
 */
export function assertModelConfigConsistent(config: ModelConfig): void {
  const mapped = new Set(Object.keys(config.inputMapping))
  for (const p of config.parameters) {
    if (p.required && !mapped.has(p.name)) {
      throw new Error(
        `模型 ${config.id} 配置错误：必填参数 "${p.name}" 缺少 inputMapping 条目`,
      )
    }
  }
}
