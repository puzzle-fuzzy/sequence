import { Elysia } from 'elysia'
import { createAuthPlugin } from '../../plugins/auth'
import { createSession, listUserSessions, getSession } from './service'

export function createTransferRoutes(secret: string) {
  return new Elysia({ prefix: '/api/transfer' })
    .use(createAuthPlugin(secret))
    .post('/sessions', ({ currentUser }) => createSession(currentUser.id), { isAuth: true })
    .get('/sessions', ({ currentUser }) => listUserSessions(currentUser.id), { isAuth: true })
    .get('/sessions/:id', ({ currentUser, params }) => getSession(currentUser.id, params.id), { isAuth: true })
  // WS signaling (/api/transfer/signaling) — Phase 7 实现 WebRTC 信令
}
