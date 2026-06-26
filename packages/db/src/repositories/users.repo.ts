import { eq } from 'drizzle-orm'
import { db } from '../client'
import { users, type NewUser, type User } from '../schema/users'

export async function createUser(input: NewUser): Promise<User> {
  const rows = await db.insert(users).values(input).returning()
  const row = rows[0]
  if (!row) throw new Error('createUser: insert returned no row')
  return row
}

export async function findUserById(id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return row ?? null
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return row ?? null
}

export async function touchLastLogin(id: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id))
}
