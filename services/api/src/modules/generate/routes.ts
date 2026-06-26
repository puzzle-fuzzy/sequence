import { Elysia, t } from 'elysia'
import { createAuthPlugin, type CurrentUser } from '../../plugins/auth'
import {
  createGenerationTask,
  getRecord,
  listUserRecords,
  retryRecord,
  cancelRecord,
  deleteRecord,
} from './service'

export function createGenerateRoutes(secret: string) {
  return new Elysia({ prefix: '/api' })
    .use(createAuthPlugin(secret))
    .post(
      '/generate',
      ({ currentUser, body }) => createGenerationTask(currentUser.id, body),
      {
        isAuth: true,
        body: t.Object({
          model: t.String(),
          category: t.String(),
          subCategory: t.String(),
          inputParams: t.Record(t.String(), t.Unknown()),
        }),
      },
    )
    .get(
      '/records',
      ({ currentUser, query }) => listUserRecords(currentUser.id, query.category),
      {
        isAuth: true,
        query: t.Object({ category: t.Optional(t.String()), limit: t.Optional(t.String()) }),
      },
    )
    .get(
      '/records/:id',
      ({ currentUser, params }) => getRecord(currentUser.id, params.id),
      { isAuth: true },
    )
    .post(
      '/records/:id/retry',
      ({ currentUser, params }) => retryRecord(currentUser.id, params.id),
      { isAuth: true },
    )
    .post(
      '/records/:id/cancel',
      ({ currentUser, params }) => cancelRecord(currentUser.id, params.id),
      { isAuth: true },
    )
    .delete(
      '/records/:id',
      ({ currentUser, params }) => deleteRecord(currentUser.id, params.id),
      { isAuth: true },
    )
}

// 引用CurrentUser类型以保留（route 通过 isAuth 注入 currentUser）
export type { CurrentUser }
