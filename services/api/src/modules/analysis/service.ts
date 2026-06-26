import {
  createProject,
  findProjectById,
  listProjects,
  findStepsByProject,
  upsertStep,
  createTask,
  type AnalysisProject,
  type AnalysisStep,
} from '@seq/db'
import { serialize } from '@seq/shared'
import { TASK_STATUS, TASK_DOMAIN } from '@seq/shared'
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/app-errors'

type StepName = AnalysisStep['step'] // 'asr' | 'script'

function toProjectResponse(p: AnalysisProject) {
  return serialize({ ...p })
}

function toStepResponse(s: AnalysisStep) {
  return serialize({ ...s })
}

export async function createAnalysisProject(userId: string, videoUrl: string) {
  const project = await createProject({ userId, videoUrl })
  return { project: toProjectResponse(project) }
}

export async function listUserProjects(userId: string) {
  const { items, total } = await listProjects(userId)
  return { items: items.map(toProjectResponse), total }
}

export async function getProjectWithSteps(userId: string, projectId: string) {
  const project = await findProjectById(projectId)
  if (!project) throw new NotFoundError('项目不存在')
  if (project.userId !== userId) throw new ForbiddenError('无权访问该项目')
  const steps = await findStepsByProject(projectId)
  return { project: toProjectResponse(project), steps: steps.map(toStepResponse) }
}

/** 执行单步：建 task（analysis.<step>）+ upsertStep(running)。实际执行由 worker (Phase 7)。 */
export async function runStep(userId: string, projectId: string, step: StepName) {
  const project = await findProjectById(projectId)
  if (!project) throw new NotFoundError('项目不存在')
  if (project.userId !== userId) throw new ForbiddenError('无权访问该项目')
  if (step !== 'asr' && step !== 'script') throw new BadRequestError(`未知步骤: ${step}`)

  const stepRow = await upsertStep(projectId, step, { status: 'running' })
  const task = await createTask({
    userId,
    type: `analysis.${step}`,
    domain: TASK_DOMAIN.ANALYSIS,
    status: TASK_STATUS.QUEUED,
    input: { projectId, step, videoUrl: project.videoUrl, stepRowId: stepRow.id },
    projectId,
  })
  await upsertStep(projectId, step, { taskId: task.id })
  return { step: toStepResponse({ ...stepRow, taskId: task.id }), taskId: task.id }
}

export async function getStepResult(userId: string, projectId: string, step: StepName) {
  const project = await findProjectById(projectId)
  if (!project) throw new NotFoundError('项目不存在')
  if (project.userId !== userId) throw new ForbiddenError('无权访问该项目')
  const steps = await findStepsByProject(projectId)
  const stepRow = steps.find((s) => s.step === step)
  if (!stepRow) throw new NotFoundError(`步骤 ${step} 不存在`)
  return { step: toStepResponse(stepRow) }
}
