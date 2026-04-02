import type { Request, Response, NextFunction } from 'express'
import { logger, requestContext } from '../utils/logger'
import { AppError } from '../utils/appError'
import { CLIENT_MESSAGES, OPERATIONAL_CODES } from '../config/errors'

function isMulterError(err: any): boolean {
  return err?.name === 'MulterError' || err?.constructor?.name === 'MulterError'
}

function normalise(err: unknown): AppError {
  if (err instanceof AppError) return err
  const e = err as any

  if (isMulterError(e)) {
    if (e.code === 'LIMIT_FILE_SIZE')
      return new AppError('FILE_TOO_LARGE', 'File exceeds the maximum allowed size', 413, { meta: { multerCode: e.code, field: e.field }, fix: 'Reduce file size or increase FILE_MAX_SIZE_BYTES in .env' })
    if (e.code === 'LIMIT_UNEXPECTED_FILE')
      return new AppError('FILE_MISSING', `Unexpected file field: "${e.field}"`, 400, { meta: { multerCode: e.code }, fix: 'Upload the file using the field name "file"' })
    return new AppError('UPLOAD_FAILED', `Upload error: ${e.message}`, 400, { meta: { multerCode: e.code } })
  }

  if (e?.message === 'Only image files are allowed')
    return new AppError('FILE_TYPE_REJECTED', 'Only image files are allowed', 415)

  if (e?.type === 'entity.too.large')
    return new AppError('PAYLOAD_TOO_LARGE', 'Request body exceeds the 1 MB limit', 413, { fix: 'Reduce the request body size. Page content must be under 1 MB.' })

  if (e?.type === 'entity.parse.failed')
    return new AppError('BAD_REQUEST', 'Request body is not valid JSON', 400, { fix: 'Ensure Content-Type is application/json and the body is valid JSON' })

  if (e?.name === 'CastError')
    return new AppError('DB_CAST_ERROR', `Invalid ID format for field "${e.path}"`, 400)

  if (e?.code === 11000)
    return new AppError('DB_DUPLICATE_KEY', 'A record with this value already exists', 409)

  if (e?.status && e?.code)
    return new AppError(e.code, e.message ?? 'Error', e.status, { fields: e.fields })

  return new AppError('INTERNAL_SERVER_ERROR', e?.message ?? 'Unexpected error', e?.status ?? 500, { cause: err })
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const appErr = normalise(err)
  const isOperational = appErr.isOperational || OPERATIONAL_CODES.has(appErr.code)
  const ctx = requestContext.getStore()
  const requestId = ctx?.requestId ?? 'no-req'

  const logMeta: Record<string, unknown> = {
    code: appErr.code, status: appErr.statusCode,
    method: req.method, path: req.path, requestId,
    ...(appErr.fields ? { fields: appErr.fields } : {}),
    ...(appErr.meta   ? appErr.meta               : {}),
    ...(appErr.fix    ? { fix: appErr.fix }        : {}),
  }

  if (isOperational) {
    logger.warn('error.handler', appErr.message, logMeta)
  } else {
    logger.error('error.handler', appErr.message, {
      ...logMeta,
      stack: appErr.stack,
      ...(appErr.cause instanceof Error ? { causeStack: (appErr.cause as Error).stack } : {}),
    })
  }

  const clientMessage =
    CLIENT_MESSAGES[appErr.code as keyof typeof CLIENT_MESSAGES] ??
    (isOperational ? appErr.message : 'An unexpected error occurred. Please try again.')

  if (!res.headersSent) {
    res.status(appErr.statusCode).json({
      error: {
        code: appErr.code,
        message: clientMessage,
        requestId,
        ...(appErr.fields ? { fields: appErr.fields } : {}),
      },
    })
  }
}
