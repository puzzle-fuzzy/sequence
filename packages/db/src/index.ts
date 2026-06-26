export { db, getDb, setDb, resetDb } from './client'
export { serialize } from '@seq/shared'
export * as schema from './schema'
export * from './schema/index'

// Repositories — re-exported for service-layer consumption
export * from './repositories/users.repo'
export * from './repositories/tasks.repo'
export * from './repositories/generation.repo'
export * from './repositories/analysis.repo'
