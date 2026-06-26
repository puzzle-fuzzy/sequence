import type { Task } from '@seq/db'
import { updateStatus, addFile } from '@seq/db'
import { createTask as bailianCreate, waitForCompletion } from '@seq/bailian-client'
import { TaskInputError } from '@seq/task-engine'
import { createLogger } from '@seq/shared'
import type { WorkerContext } from '../context'
import { getWorkerModelConfig } from '../worker-models'
import { extractFromQueryOutput, extractFromSyncImage } from '../product-extractor'

const logger = createLogger('worker:generate')

interface GenerateTaskInput {
  recordId?: string
  model?: string
  category?: string
  subCategory?: string
  params?: Record<string, unknown>
}

/**
 * generate.{video|image|audio} handler。
 *
 * 流程：取 task.input → 查 worker 模型 → 调百炼 → 提取产物 → 下载入库 → 更新 record。
 * 异步模型用 waitForCompletion 在 claimTtl 内同步等待（简化多轮编排）。
 * 同步模型结果直接在 createTask 响应中。
 */
export async function handleGenerate(task: Task, ctx: WorkerContext): Promise<Record<string, unknown>> {
  const input = task.input as GenerateTaskInput
  if (!input.recordId || !input.model || !input.category || !input.params) {
    throw new TaskInputError(`generate task 缺少必要输入字段: ${JSON.stringify(Object.keys(input))}`)
  }
  const modelConfig = getWorkerModelConfig(input.category, input.subCategory ?? '', input.model)
  if (!modelConfig) throw new TaskInputError(`worker 未知模型: ${input.model}`)

  const params = input.params
  try {
    if (modelConfig.async) {
      // 异步：create → 拿 taskId → waitForCompletion 同步等待
      const created = await bailianCreate(ctx.bailian, modelConfig, params)
      const result = await waitForCompletion(ctx.bailian, created.output.task_id, {
        intervalMs: 15_000,
        maxAttempts: 40,
      })
      const files = extractFromQueryOutput(input.category, result.output)
      await persistFiles(ctx, input.recordId, files, input.category)
      await updateStatus(input.recordId, 'succeeded', { outputResult: result.output as Record<string, unknown> })
      return { taskId: created.output.task_id, fileCount: files.length }
    }

    // 同步（image/audio）：createTask 响应内含结果
    const res = await bailianCreate(ctx.bailian, modelConfig, params)
    const syncOut = res as unknown as {
      output?: {
        choices?: Array<{ message?: { content?: Array<{ image?: string }> } }>
        audio?: { url?: string }
      }
    }

    let files = extractFromSyncImage(syncOut.output?.choices ?? [])
    if (input.category === 'audio' && syncOut.output?.audio?.url) {
      files = [{ url: syncOut.output.audio.url, kind: 'primary' }]
    }
    await persistFiles(ctx, input.recordId, files, input.category)
    await updateStatus(input.recordId, 'succeeded', {
      outputResult: syncOut.output as Record<string, unknown>,
    })
    return { fileCount: files.length }
  } catch (e) {
    await updateStatus(input.recordId, 'failed', {
      errorMessage: e instanceof Error ? e.message : String(e),
    } as Record<string, unknown>)
    throw e // 让 task-engine 决定 retry/fail
  }
}

/** 下载产物文件到本地/OSS 并写入 generation_files。 */
async function persistFiles(
  ctx: WorkerContext,
  recordId: string,
  files: Array<{ url: string; kind: string }>,
  category: string,
): Promise<void> {
  const defaultExt = category === 'audio' ? 'mp3' : category === 'image' ? 'png' : 'mp4'
  for (const f of files) {
    const info = await ctx.storage.downloadFromUrl(recordId, f.url, defaultExt)
    await addFile({
      recordId,
      kind: f.kind,
      sourceUrl: f.url,
      storagePath: info.storagePath,
      mimeType: info.mimeType ?? undefined,
      sizeBytes: info.sizeBytes ?? undefined,
    })
  }
}
