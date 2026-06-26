import { eq } from 'drizzle-orm'
import { db, users, createUser, findUserByEmail, findUserById, touchLastLogin, type User } from '@seq/db'
import { ConflictError, UnauthorizedError } from '../../lib/app-errors'

export interface AuthUserResponse {
  id: string
  username: string
  email: string
  avatar: string | null
  role: 'user' | 'admin'
  lastLoginAt: string | null
}

function toResponse(u: User): AuthUserResponse {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    avatar: u.avatar,
    role: u.role,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  }
}

export async function registerUser(input: { username: string; email: string; password: string }): Promise<AuthUserResponse> {
  const [byUsername] = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1)
  if (byUsername) throw new ConflictError('用户名已被使用')
  const [byEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1)
  if (byEmail) throw new ConflictError('邮箱已被使用')

  const passwordHash = await Bun.password.hash(input.password)
  const created = await createUser({ username: input.username, email: input.email, password: passwordHash })
  return toResponse(created)
}

export interface LoginResult {
  user: AuthUserResponse
  /** 接收路由层 jwt 实例签发 token（避免 service 层依赖 elysia jwt） */
  sign: (jwt: { sign: (p: unknown) => Promise<string> }) => Promise<string>
}

export async function loginUser(input: { email: string; password: string }): Promise<LoginResult> {
  const user = await findUserByEmail(input.email)
  if (!user) throw new UnauthorizedError('邮箱或密码错误')
  const ok = await Bun.password.verify(input.password, user.password)
  if (!ok) throw new UnauthorizedError('邮箱或密码错误')
  await touchLastLogin(user.id)
  return {
    user: toResponse(user),
    sign: (jwt) => jwt.sign({ sub: user.id, role: user.role }),
  }
}

export async function getUserById(id: string): Promise<AuthUserResponse> {
  const user = await findUserById(id)
  if (!user) throw new UnauthorizedError('用户不存在')
  return toResponse(user)
}
