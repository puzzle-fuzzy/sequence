import { createTaskHandlerRegistry, type TaskDefinition } from '@seq/task-engine'
import type { Task } from '@seq/db'
import type { WorkerContext } from './context'
import { handleGenerate } from './handlers/generate'
import { handleAnalysis } from './handlers/analysis'

const definitions: Array<TaskDefinition<Task, WorkerContext>> = [
  { type: 'generate.video', handler: handleGenerate },
  { type: 'generate.image', handler: handleGenerate },
  { type: 'generate.audio', handler: handleGenerate },
  { type: 'analysis.asr', handler: handleAnalysis },
  { type: 'analysis.script', handler: handleAnalysis },
]

/** task type → handler 注册表。新增 task type 在此登记一行。 */
export const registry = createTaskHandlerRegistry<Task, WorkerContext>(definitions)
