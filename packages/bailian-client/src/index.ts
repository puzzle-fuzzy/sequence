export type {
  BailianClientConfig,
  CreateTaskResponse,
  QueryTaskResponse,
  QueryTaskOutput,
  ApiErrorResponse,
} from './types'
export { DEFAULT_BASE_URL } from './types'
export { applyMappings, buildRequestBody } from './request-builder'
export { createTask, queryTask, waitForCompletion } from './client'
export type { PollOptions } from './client'
export { translateBailianError, formatBailianError } from './errors'
// ASR（Paraformer 录音文件识别）
export {
  submitAsr,
  queryAsrTask,
  fetchTranscription,
  runAsr,
  msToSrtTime,
} from './asr'
export type { AsrResult, AsrSentence, AsrTaskStatus } from './asr'
// LLM 多模态（qwen-vl-plus）
export { chatMultimodal } from './llm'
export type { MultimodalContent, ChatMultimodalInput, ChatMultimodalResult } from './llm'
