import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

/**
 * 鉴权门 — 未登录时显示登录/注册表单，已登录时渲染 children。
 * 保持现有 shadcn radix-luma 风格（中性色、Inter、圆角）。
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (user) return <>{children}</>

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(username, email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">奇想园</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? '登录以继续创作' : '创建账户开始创作'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring/50"
            />
          )}
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </Button>
        </form>

        <div className="text-center text-sm">
          {mode === 'login' ? (
            <button onClick={() => { setMode('register'); setError(null) }} className="text-muted-foreground hover:text-foreground transition-colors">
              没有账户？注册
            </button>
          ) : (
            <button onClick={() => { setMode('login'); setError(null) }} className="text-muted-foreground hover:text-foreground transition-colors">
              已有账户？登录
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
