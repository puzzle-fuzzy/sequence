import { Elysia, t } from 'elysia'
import { createAuthPlugin, AUTH_COOKIE_OPTIONS, AUTH_COOKIE_NAME, signUserToken, type JwtSigner } from '../../plugins/auth'
import { registerUser, loginUser, getUserById } from './service'

/** 安全获取 auth cookie（noUncheckedIndexedAccess 下 cookie[KEY] 可能 undefined）。 */
function getAuthCookie(cookie: Record<string, { set: (opts: Record<string, unknown>) => void; remove: () => void } | undefined>) {
  const c = cookie[AUTH_COOKIE_NAME]
  if (!c) throw new Error(`auth cookie "${AUTH_COOKIE_NAME}" 不存在`)
  return c
}

export function createAuthRoutes(secret: string) {
  return new Elysia({ prefix: '/api/auth' })
    .use(createAuthPlugin(secret))
    .post(
      '/register',
      async ({ body, cookie, jwt }) => {
        const user = await registerUser(body)
        const token = await signUserToken(jwt as unknown as JwtSigner, user)
        getAuthCookie(cookie as never).set({ ...AUTH_COOKIE_OPTIONS, value: token })
        return { user }
      },
      {
        body: t.Object({ username: t.String(), email: t.String(), password: t.String() }),
      },
    )
    .post(
      '/login',
      async ({ body, cookie, jwt }) => {
        const { user, sign } = await loginUser(body)
        const token = await sign(jwt as unknown as JwtSigner)
        getAuthCookie(cookie as never).set({ ...AUTH_COOKIE_OPTIONS, value: token })
        return { user }
      },
      {
        body: t.Object({ email: t.String(), password: t.String() }),
      },
    )
    .get('/me', ({ currentUser }) => getUserById(currentUser.id), { isAuth: true })
    .post('/logout', ({ cookie }) => {
      getAuthCookie(cookie as never).remove()
      return { ok: true }
    })
}
