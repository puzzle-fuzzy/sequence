import { loadConfig, type AppConfig } from '@seq/shared'

/** 服务端配置 — 路由组显式接收而非读 process.env，便于测试注入。 */
export interface ServerConfig {
  port: number
  corsOrigin: string[]
  nodeEnv: string
  app: AppConfig
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3000),
    corsOrigin: (env.CORS_ORIGIN ?? 'http://localhost:5174').split(','),
    nodeEnv: env.NODE_ENV ?? 'development',
    app: loadConfig(env),
  }
}
