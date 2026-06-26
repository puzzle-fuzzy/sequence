import { Elysia } from 'elysia'

/** 统一错误基类 — 路由 throw 子类，全局 onError 序列化。 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number
  abstract readonly code: string
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = 400
  readonly code = 'BAD_REQUEST'
}
export class UnauthorizedError extends AppError {
  readonly statusCode = 401
  readonly code = 'UNAUTHORIZED'
}
export class ForbiddenError extends AppError {
  readonly statusCode = 403
  readonly code = 'FORBIDDEN'
}
export class NotFoundError extends AppError {
  readonly statusCode = 404
  readonly code = 'NOT_FOUND'
}
export class ConflictError extends AppError {
  readonly statusCode = 409
  readonly code = 'CONFLICT'
}
export class ValidationError extends AppError {
  readonly statusCode = 422
  readonly code = 'VALIDATION'
  constructor(message: string, readonly errors?: unknown) {
    super(message)
  }
}
export class InternalError extends AppError {
  readonly statusCode = 500
  readonly code = 'INTERNAL'
}

/** 全局错误处理 plugin — 序列化所有 AppError 子类为 { error, code, message }。 */
export const errorHandlerPlugin = new Elysia({ name: 'error-handler' }).onError(({ error, set }) => {
  if (error instanceof AppError) {
    set.status = error.statusCode
    return {
      error: error.code,
      code: error.code,
      message: error.message,
      ...(error instanceof ValidationError && error.errors ? { errors: error.errors } : {}),
    }
  }
  set.status = 500
  return {
    error: 'INTERNAL',
    code: 'INTERNAL',
    message: error instanceof Error ? error.message : String(error),
  }
})
