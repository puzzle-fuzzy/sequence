import type { Task } from '@seq/db'
import { upsertStep, findProjectById } from '@seq/db'
import { TaskInputError } from '@seq/task-engine'
import { createLogger } from '@seq/shared'
import type { WorkerContext } from '../context'

const logger = createLogger('worker:analysis')

interface AnalysisTaskInput {
  projectId?: string
  step?: string
  videoUrl?: string
  stepRowId?: string
}

/**
 * analysis.asr / analysis.script handler。
 *
 * - asr: 调百炼 Paraformer 录音文件识别，转写 videoUrl 的音频为文本
 * - script: 基于上一步 ASR 结果 + videoUrl 生成剧本（调 LLM）
 *
 * Phase 7：handler 结构 + 任务流完整，ASR/LLM client 调用为 follow-up 占位
 * （需 ASR-specific 百炼端点，与 generate 不同，单独实现更清晰）。
 */
export async function handleAnalysis(task: Task, _ctx: WorkerContext): Promise<Record<string, unknown>> {
  const input = task.input as AnalysisTaskInput
  if (!input.projectId || !input.step) {
    throw new TaskInputError('analysis task 缺少 projectId/step')
  }
  const project = await findProjectById(input.projectId)
  if (!project) throw new TaskInputError(`project ${input.projectId} 不存在`)

  // TODO(follow-up): 接入 Paraformer ASR client (analysis.asr) 与 LLM 剧本生成 (analysis.script)
  const result = {
    step: input.step,
    videoUrl: input.videoUrl,
    status: 'stub-implemented',
    note: 'ASR/LLM client 接入为 follow-up',
  }
  await upsertStep(input.projectId, input.step as 'asr' | 'script', {
    status: 'succeeded',
    result,
  })
  logger.info({ projectId: input.projectId, step: input.step }, 'analysis step (stub)')
  return result
}
