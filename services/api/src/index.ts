import { Elysia } from 'elysia'
import { cors } from '@elysia/cors'
import { openapi } from '@elysia/openapi'
import { loadServerConfig } from './config'
import { handleError } from './lib/app-errors'
import { createAuthRoutes } from './modules/auth/routes'
import { createCatalogRoutes } from './modules/catalog/routes'
import { createGenerateRoutes } from './modules/generate/routes'
import { createAnalysisRoutes } from './modules/analysis/routes'
import { createTransferRoutes } from './modules/transfer/routes'
import { createUploadRoutes } from './modules/upload/routes'
import { createHealthRoutes } from './modules/health/routes'

const config = loadServerConfig()

const app = new Elysia()
  .onError(handleError)
  .use(cors({ credentials: true, origin: config.corsOrigin }))
  .use(
    openapi({
      documentation: {
        info: { title: 'sequence API', version: '0.1.0', description: 'sequence backend — uhyc v2' },
      },
    }),
  )
  .use(createAuthRoutes(config.app.jwtSecret))
  .use(createCatalogRoutes())
  .use(createGenerateRoutes(config.app.jwtSecret))
  .use(createAnalysisRoutes(config.app.jwtSecret))
  .use(createTransferRoutes(config.app.jwtSecret))
  .use(createUploadRoutes(config.app.jwtSecret))
  .use(createHealthRoutes())
  .listen(config.port)

console.log(`🦊 sequence api at ${app.server?.hostname}:${app.server?.port}`)

export default app
export type App = typeof app
