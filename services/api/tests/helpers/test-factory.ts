import { treaty } from '@elysia/eden'
import type { Elysia } from 'elysia'
import type { ServerConfig } from '../../src/config'
import { createUser } from '@seq/db'

/** 测试用 ServerConfig（不真正监听端口）。 */
export function makeTestConfig(): ServerConfig {
  return {
    port: 0,
    corsOrigin: ['*'],
    nodeEnv: 'test',
    app: {
      databaseUrl: process.env.DATABASE_URL!,
      jwtSecret: 'test-secret',
      bailianApiKey: 'test-key',
      bailianBaseUrl: 'https://example.com',
      storageDir: './.tmp-test-storage',
    },
  }
}

/** 直连 repo 创建用户（绕过路由），返回 { id, role }。 */
export async function makeAccount(input: {
  username: string
  email: string
  password?: string
  role?: 'user' | 'admin'
}) {
  const passwordHash = await Bun.password.hash(input.password ?? 'password123')
  return createUser({
    username: input.username,
    email: input.email,
    password: passwordHash,
    role: input.role ?? 'user',
  })
}

/** 对一个 Elysia 实例创建 treaty 代理。
 * 返回 any —— treaty 的深层路径类型推断在测试场景下过于严格，
 * 测试通过 status/error/data 字段断言即可。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function treatyFor(app: Elysia): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return treaty(app as Elysia) as any
}

/** Eden 响应 { data, error } → 提取 data 或抛 error。 */
export function unwrap<T>(res: { data: T | null; error: { status: number; value: unknown } | null }): T {
  if (res.error) {
    const e = res.error as { status: number; value: unknown }
    throw Object.assign(new Error(`HTTP ${e.status}`), { status: e.status, body: e.value })
  }
  return res.data as T
}
