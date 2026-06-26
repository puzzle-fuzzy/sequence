import { TASK_DOMAIN, type TaskDomain } from './domain-types'

export interface AppConfig {
  databaseUrl: string
  jwtSecret: string
  bailianApiKey: string
  bailianBaseUrl: string
  storageDir: string
  oss?: {
    region: string
    accessKeyId: string
    accessKeySecret: string
    bucket: string
    uploadPrefix: string
  }
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key]
  if (!v) throw new Error(`缺少必需环境变量: ${key}`)
  return v
}

/** 从 env 解析强类型配置。OSS 字段缺一即视为未配置 OSS。 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const ossKeys = ['OSS_REGION', 'OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET'] as const
  const ossConfigured = ossKeys.every((k) => env[k])
  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtSecret: required(env, 'JWT_SECRET'),
    bailianApiKey: required(env, 'BAILIAN_API_KEY'),
    bailianBaseUrl: env.BAILIAN_BASE_URL ?? 'https://dashscope.aliyuncs.com/api/v1',
    storageDir: env.STORAGE_DIR ?? './storage',
    ...(ossConfigured
      ? {
          oss: {
            region: env.OSS_REGION!,
            accessKeyId: env.OSS_ACCESS_KEY_ID!,
            accessKeySecret: env.OSS_ACCESS_KEY_SECRET!,
            bucket: env.OSS_BUCKET!,
            uploadPrefix: env.OSS_UPLOAD_PREFIX ?? 'sequence',
          },
        }
      : {}),
  }
}

/** 校验 task domain 字符串是否合法。 */
export function isValidTaskDomain(s: string): s is TaskDomain {
  return Object.values(TASK_DOMAIN).includes(s as TaskDomain)
}
