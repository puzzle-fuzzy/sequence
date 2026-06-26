import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { handleError } from '../src/lib/app-errors'
import { createCatalogRoutes } from '../src/modules/catalog/routes'
import { treatyFor } from './helpers/test-factory'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app: any = new Elysia().onError(handleError).use(createCatalogRoutes())
const api = treatyFor(app)

describe('catalog routes', () => {
  it('GET /catalog returns the model registry', async () => {
    const res = await api.api.catalog.get()
    expect(res.status).toBe(200)
    expect(res.error).toBeNull()
    expect(res.data?.models.length).toBeGreaterThanOrEqual(5)
    // 每个模型有 id / requestType / inputMapping
    const first = res.data?.models[0]
    expect(first?.id).toBeTruthy()
    expect(first?.requestType).toBeTruthy()
    expect(first?.inputMapping).toBeTruthy()
  })
})
