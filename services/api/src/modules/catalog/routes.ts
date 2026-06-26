import { Elysia } from 'elysia'
import { ALL_MODELS } from '../generate/registry'

/** catalog 路由 — 返回全部生成模型，驱动前端表单渲染。 */
export function createCatalogRoutes() {
  return new Elysia({ prefix: '/api' }).get('/catalog', () => ({ models: ALL_MODELS }))
}
