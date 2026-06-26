import { Elysia, status, t } from 'elysia'
import { jwt } from '@elysia/jwt'

const AUTH_COOKIE = 'auth'

export interface CurrentUser {
  id: string
  role: 'user' | 'admin'
}

/**
 * Auth plugin — 注册 jwt helper + isAuth 宏。
 * 路由组用 { isAuth: true } 要求鉴权，成功注入 currentUser。
 */
export function createAuthPlugin(secret: string) {
  return new Elysia({ name: 'auth' })
    .use(
      jwt({
        name: 'jwt',
        secret,
        schema: t.Object({
          sub: t.String(),
          role: t.Union([t.Literal('user'), t.Literal('admin')]),
        }),
        exp: '7d',
      }),
    )
    .macro({
      isAuth: {
        resolve: async ({ cookie, jwt }) => {
          const authCookie = cookie[AUTH_COOKIE]
          const token: string | undefined = authCookie?.value as string | undefined
          const payload = token ? await jwt.verify(token) : false
          if (!payload) return status(401, { error: 'Unauthorized' })
          return { currentUser: { id: payload.sub, role: payload.role } as CurrentUser }
        },
      },
    })
}

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
}

export const AUTH_COOKIE_NAME = AUTH_COOKIE

/** 签发 JWT（service 层用）。jwt 实例由路由层注入。 */
export async function signUserToken(
  jwt: { sign: (p: unknown) => Promise<string> },
  user: { id: string; role: 'user' | 'admin' },
): Promise<string> {
  return jwt.sign({ sub: user.id, role: user.role })
}

/** login service 回调用的 jwt 签名接口（避免 service 层 import elysia jwt 类型）。 */
export interface JwtSigner {
  sign: (payload: unknown) => Promise<string>
}
