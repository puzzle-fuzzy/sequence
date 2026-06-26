import { useCallback, useEffect, useState } from 'react'
import { api, unwrap } from '@/lib/api'

export interface AuthUser {
  id: string
  username: string
  email: string
  avatar: string | null
  role: 'user' | 'admin'
  lastLoginAt: string | null
}

interface UseAuthResult {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

/**
 * Auth hook — 管理当前用户态。
 *
 * mount 时调 /api/auth/me 探测登录态（cookie 同源）。
 * 401 → 未登录；200 → 已登录，存 user。
 * login/register 成功后后端 Set-Cookie，直接存返回的 user。
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.api.auth.me.get()
        if (!cancelled && res.data) setUser(res.data as AuthUser)
      } catch {
        // 401 = 未登录，忽略
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.api.auth.login.post({ email, password })
    const { user: u } = unwrap(res as never) as { user: AuthUser }
    setUser(u)
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const res = await api.api.auth.register.post({ username, email, password })
    const { user: u } = unwrap(res as never) as { user: AuthUser }
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    await api.api.auth.logout.post()
    setUser(null)
  }, [])

  return { user, loading, login, register, logout }
}
