import type { ModelConfig } from './types'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/** 校验用户输入参数是否符合模型定义的约束。前后端均可调用。 */
export function validate(config: ModelConfig, params: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = []

  for (const field of config.parameters) {
    const value = params[field.name]

    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: field.name, message: `${field.label} 为必填项` })
      continue
    }
    if (value === undefined || value === null || value === '') continue

    switch (field.type) {
      case 'text': {
        if (typeof value !== 'string') {
          errors.push({ field: field.name, message: `${field.label} 必须为文本` })
          break
        }
        if (field.maxLength !== undefined && value.length > field.maxLength) {
          errors.push({ field: field.name, message: `${field.label} 不能超过 ${field.maxLength} 个字符（当前 ${value.length}）` })
        }
        break
      }
      case 'number': {
        if (typeof value !== 'number') {
          errors.push({ field: field.name, message: `${field.label} 必须为数字` })
          break
        }
        if (field.min !== undefined && value < field.min) {
          errors.push({ field: field.name, message: `${field.label} 最小值为 ${field.min}` })
        }
        if (field.max !== undefined && value > field.max) {
          errors.push({ field: field.name, message: `${field.label} 最大值为 ${field.max}` })
        }
        break
      }
      case 'boolean': {
        if (typeof value !== 'boolean') {
          errors.push({ field: field.name, message: `${field.label} 必须为布尔值` })
        }
        break
      }
      case 'select': {
        if (field.options && !field.options.some((o) => o.value === value)) {
          errors.push({ field: field.name, message: `${field.label} 的值 "${value}" 不在可选项中` })
        }
        break
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/** 从用户参数中提取合法子集（只保留 config.parameters 中声明过的 key）。 */
export function sanitize(config: ModelConfig, params: Record<string, unknown>): Record<string, unknown> {
  const validKeys = new Set(config.parameters.map((p) => p.name))
  const result: Record<string, unknown> = {}
  for (const key of validKeys) {
    if (key in params) result[key] = params[key]
  }
  return result
}

/** 合并默认值：用户未填写的可选字段使用默认值填充。 */
export function applyDefaults(config: ModelConfig, params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of config.parameters) {
    const value = params[field.name]
    if (value !== undefined && value !== null && value !== '') {
      result[field.name] = value
    } else if (field.defaultValue !== undefined) {
      result[field.name] = field.defaultValue
    }
  }
  return result
}
