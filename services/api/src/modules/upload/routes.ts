import { Elysia, t } from 'elysia'
import { createAuthPlugin } from '../../plugins/auth'
import { loadServerConfig, type ServerConfig } from '../../config'
import { uploadFile, deleteUpload } from './service'

export function createUploadRoutes(secret: string, config: ServerConfig = loadServerConfig()) {
  return new Elysia({ prefix: '/api/upload' })
    .use(createAuthPlugin(secret))
    .post(
      '/',
      ({ currentUser, body: { file } }) => uploadFile(config, currentUser.id, file),
      {
        isAuth: true,
        body: t.Object({ file: t.File() }),
      },
    )
    .delete('/:id', ({ currentUser, params }) => deleteUpload(currentUser.id, params.id), { isAuth: true })
}
