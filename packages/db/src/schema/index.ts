import { users } from './users'
import { tasks } from './tasks'
import { generationRecords, generationFiles } from './generation'
import { analysisProjects, analysisSteps } from './analysis'
import { transferSessions } from './transfer'
import { uploadedFiles } from './uploads'

export * from './users'
export * from './tasks'
export * from './generation'
export * from './analysis'
export * from './transfer'
export * from './uploads'

/** 聚合表 map，便于批量 import / drizzle-typebox 工具 */
export const table = {
  users,
  tasks,
  generationRecords,
  generationFiles,
  analysisProjects,
  analysisSteps,
  transferSessions,
  uploadedFiles,
} as const
