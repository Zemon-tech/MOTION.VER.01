/**
 * AppError — the single error class used throughout the codebase.
 *
 * Every thrown error should be an AppError so the error handler can
 * distinguish operational errors (expected) from programmer errors (bugs).
 *
 * Usage:
 *   throw new AppError('NOT_FOUND', 'Page not found', 404)
 *   throw new AppError('TOKEN_EXPIRED', 'Session expired', 401, {
 *     fix: 'Call POST /auth/refresh to get a new access token'
 *   })
 */

import type { ErrorCode } from '../config/errors'

export interface AppErrorOptions {
  /** Developer-facing hint about how to fix this — appears in logs, never sent to client */
  fix?: string
  /** Extra context for the log line */
  meta?: Record<string, unknown>
  /** Field-level validation errors */
  fields?: Record<string, string>
  /** Original cause (for wrapping lower-level errors) */
  cause?: unknown
}

export class AppError extends Error {
  readonly code:          string
  readonly statusCode:    number
  readonly isOperational: boolean
  readonly fix?:          string
  readonly meta?:         Record<string, unknown>
  readonly fields?:       Record<string, string>
  readonly cause?:        unknown

  constructor(
    code: ErrorCode | string,
    message: string,
    statusCode = 500,
    options: AppErrorOptions = {},
  ) {
    super(message)
    this.name        = 'AppError'
    this.code        = code
    this.statusCode  = statusCode
    this.fix         = options.fix
    this.meta        = options.meta
    this.fields      = options.fields
    this.cause       = options.cause
    // Operational = 4xx or known error codes. 5xx without a known code = programmer error.
    this.isOperational = statusCode < 500

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype)
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }

  /** Convenience factory for common cases */
  static notFound(resource: string, id?: string): AppError {
    return new AppError(
      'NOT_FOUND',
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      404,
      { fix: `Check that the ${resource.toLowerCase()} ID is correct and the record exists` },
    )
  }

  static forbidden(reason: string): AppError {
    return new AppError('FORBIDDEN', reason, 403)
  }

  static badRequest(message: string, fields?: Record<string, string>): AppError {
    return new AppError('BAD_REQUEST', message, 400, { fields })
  }

  static internal(message: string, cause?: unknown): AppError {
    return new AppError('INTERNAL_SERVER_ERROR', message, 500, { cause })
  }
}
