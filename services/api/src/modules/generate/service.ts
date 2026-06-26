import {
  createRecord,
  findRecordById,
  listRecords,
  updateStatus,
  softDelete,
  createTask,
  type GenerationRecord,
} from '@seq/db'
import { sanitize, applyDefaults, validate } from '@seq/bailian-core'
import { TASK_STATUS, TASK_DOMAIN } from '@seq/shared'
import { findModel } from './registry'
import { toRecordResponse } from './to-response'
import { NotFoundError, ValidationError, ForbiddenError, BadRequestError } from '../../lib/app-errors'

export interface CreateTaskInput {
  model: string
  category: string
  subCategory: string
  inputParams: Record<string, unknown>
}

export interface CreateTaskResult {
  record: ReturnType<typeof toRecordResponse>
  taskId: string
}

/**
 * 创建生成任务：校验 → sanitize → applyDefaults → 建 record(submitting) → 建 task(queued)。
 * 不调用百炼 —— 实际生成由 worker (Phase 7) 认领 task 后驱动。
 */
export async function createGenerationTask(userId: string, input: CreateTaskInput): Promise<CreateTaskResult> {
  const config = findModel(input.category, input.subCategory, input.model)
  if (!config) throw new NotFoundError('未找到模型')

  const sanitized = sanitize(config, input.inputParams)
  const validation = validate(config, sanitized)
  if (!validation.valid) {
    throw new ValidationError('参数校验失败', validation.errors)
  }
  const finalParams = applyDefaults(config, sanitized)

  // 先落 record（即便后续失败也有记录）
  const record = await createRecord({
    userId,
    model: config.model,
    category: config.category,
    subCategory: config.subCategory,
    inputParams: finalParams,
    status: 'submitting',
  })

  // 入队 task：type = generate.<category>，domain = generate
  const task = await createTask({
    userId,
    type: `generate.${config.category}`,
    domain: TASK_DOMAIN.GENERATE,
    status: TASK_STATUS.QUEUED,
    input: { recordId: record.id, model: config.model, category: config.category, subCategory: config.subCategory, params: finalParams },
    recordId: record.id,
  })

  // record 状态推进到 processing（已入队）
  await updateStatus(record.id, 'processing')

  return { record: toRecordResponse(record), taskId: task.id }
}

export async function getRecord(userId: string, recordId: string) {
  const found = await findRecordById(recordId)
  if (!found) throw new NotFoundError('记录不存在')
  if (found.record.userId !== userId) throw new ForbiddenError('无权访问该记录')
  return { record: toRecordResponse(found.record, found.files) }
}

export async function listUserRecords(userId: string, category?: string, limit = 50) {
  const { items } = await listRecords(userId, limit)
  const filtered = category ? items.filter((r) => r.category === category) : items
  return {
    items: filtered.map((r) => toRecordResponse(r)),
    total: filtered.length,
  }
}

/** 重试：基于原 record 的 inputParams 重新入队一个 task。 */
export async function retryRecord(userId: string, recordId: string): Promise<CreateTaskResult> {
  const found = await findRecordById(recordId)
  if (!found) throw new NotFoundError('记录不存在')
  if (found.record.userId !== userId) throw new ForbiddenError('无权访问该记录')
  if (found.record.status === 'succeeded' || found.record.status === 'processing') {
    throw new BadRequestError('该记录当前不可重试')
  }

  const record = found.record
  const config = findModel(record.category, record.subCategory, record.model)
  if (!config) throw new NotFoundError('模型已下线')

  await updateStatus(record.id, 'processing')
  const task = await createTask({
    userId,
    type: `generate.${config.category}`,
    domain: TASK_DOMAIN.GENERATE,
    status: TASK_STATUS.QUEUED,
    input: { recordId: record.id, model: record.model, category: record.category, subCategory: record.subCategory, params: record.inputParams },
    recordId: record.id,
  })
  return { record: toRecordResponse(record), taskId: task.id }
}

/** 取消：取消关联的 task（worker 侧终态后不再处理）。 */
export async function cancelRecord(userId: string, recordId: string) {
  const found = await findRecordById(recordId)
  if (!found) throw new NotFoundError('记录不存在')
  if (found.record.userId !== userId) throw new ForbiddenError('无权访问该记录')
  await updateStatus(recordId, 'cancelled')
  return { ok: true }
}

export async function deleteRecord(userId: string, recordId: string) {
  const found = await findRecordById(recordId)
  if (!found) throw new NotFoundError('记录不存在')
  if (found.record.userId !== userId) throw new ForbiddenError('无权访问该记录')
  await softDelete(recordId)
  return { ok: true }
}

export type { GenerationRecord }
