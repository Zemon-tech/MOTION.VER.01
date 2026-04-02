/**
 * Maps every Mongoose / MongoDB error to a structured AppError with a
 * human-readable log message and a safe client response.
 *
 * Every error type answers: what broke, why, and what to do.
 */

import mongoose from 'mongoose'
import { AppError } from './appError'
import { logger } from './logger'

// ─── Duplicate key field extractor ───────────────────────────────────────────

function extractDuplicateField(err: any): string {
  // MongoDB 4.4+ includes keyValue
  if (err.keyValue) {
    return Object.keys(err.keyValue).join(', ')
  }
  // Fallback: parse the errmsg string
  const match = (err.message as string).match(/index: (\S+) dup key/)
  return match?.[1] ?? 'unknown field'
}

function extractDuplicateValue(err: any): string {
  if (err.keyValue) {
    return Object.values(err.keyValue).map((v) => String(v)).join(', ')
  }
  const match = (err.message as string).match(/dup key: \{ (.+?) \}/)
  return match?.[1] ?? 'unknown value'
}

// ─── Redact MongoDB URI for logging ──────────────────────────────────────────

export function redactMongoUri(uri: string): string {
  try {
    const u = new URL(uri)
    return `${u.protocol}//${u.hostname}${u.pathname}`
  } catch {
    return '[invalid URI]'
  }
}

// ─── Main mapper ─────────────────────────────────────────────────────────────

export function handleDbError(
  err: unknown,
  context: {
    operation: string   // e.g. 'Page.findById', 'User.create'
    collection?: string
    userId?: string
    pageId?: string
  },
): AppError {
  const { operation, collection, userId, pageId } = context
  const meta: Record<string, unknown> = {
    operation,
    ...(collection ? { collection } : {}),
    ...(userId     ? { userId }     : {}),
    ...(pageId     ? { pageId }     : {}),
  }

  // ── CastError — invalid ObjectId ──────────────────────────────────────────
  if (err instanceof mongoose.Error.CastError) {
    logger.warn('db.error', `CastError in ${operation} — invalid ${err.kind} for path "${err.path}"`, {
      ...meta,
      path:  err.path,
      kind:  err.kind,
      value: String(err.value).slice(0, 64),
      fix:   `Ensure the ID passed to ${operation} is a valid 24-character MongoDB ObjectId`,
    })
    return new AppError('DB_CAST_ERROR', `Invalid ID format for field "${err.path}"`, 400, {
      fix: `Pass a valid 24-character hex ObjectId`,
      meta,
    })
  }

  // ── ValidationError — schema validation failed ─────────────────────────────
  if (err instanceof mongoose.Error.ValidationError) {
    const fields: Record<string, string> = {}
    for (const [path, ve] of Object.entries(err.errors)) {
      fields[path] = ve.message
    }
    logger.warn('db.error', `ValidationError in ${operation} — document failed schema validation`, {
      ...meta,
      fields,
      fix: `Check the document fields against the Mongoose schema for ${collection ?? 'the collection'}`,
    })
    return new AppError('DB_VALIDATION_ERROR', 'Document failed schema validation', 400, { fields, meta })
  }

  // ── VersionError — optimistic concurrency conflict ─────────────────────────
  if (err instanceof mongoose.Error.VersionError) {
    logger.warn('db.error', `VersionError in ${operation} — document modified by concurrent request`, {
      ...meta,
      fix: 'Retry the operation after re-fetching the document',
    })
    return new AppError('DB_VERSION_ERROR', 'Concurrent modification conflict', 409, {
      fix: 'Retry after re-fetching the document',
      meta,
    })
  }

  // ── MongoServerError — covers DuplicateKey (code 11000) and others ─────────
  const mongoErr = err as any
  if (mongoErr?.name === 'MongoServerError' || mongoErr?.name === 'MongoError') {
    // Duplicate key
    if (mongoErr.code === 11000) {
      const field = extractDuplicateField(mongoErr)
      const value = extractDuplicateValue(mongoErr)
      logger.warn('db.error', `DuplicateKeyError in ${operation} — unique constraint violated on "${field}"`, {
        ...meta,
        field,
        // Redact value if it looks like an email
        value: field.includes('email') ? '[redacted]' : value.slice(0, 64),
        fix:   `A document with this ${field} already exists. Check for duplicates before inserting.`,
      })
      return new AppError('DB_DUPLICATE_KEY', `A record with this ${field} already exists`, 409, { meta })
    }

    // Write concern error
    if (mongoErr.code === 64 || mongoErr.writeConcernError) {
      logger.error('db.error', `WriteConcernError in ${operation} — write not acknowledged by replica set`, {
        ...meta,
        code: mongoErr.code,
        fix:  'Check MongoDB replica set health and write concern configuration',
      })
      return new AppError('DB_WRITE_CONCERN', 'Database write was not confirmed', 503, { meta })
    }

    logger.error('db.error', `MongoServerError in ${operation} — code ${mongoErr.code}: ${mongoErr.message}`, {
      ...meta,
      code:  mongoErr.code,
      stack: mongoErr.stack,
      fix:   'Check MongoDB server logs for details',
    })
    return new AppError('INTERNAL_SERVER_ERROR', 'Database server error', 500, { meta })
  }

  // ── MongoNetworkError — connection lost mid-request ────────────────────────
  if (mongoErr?.name === 'MongoNetworkError' || mongoErr?.name === 'MongoNetworkTimeoutError') {
    logger.error('db.error', `MongoNetworkError in ${operation} — lost connection to MongoDB`, {
      ...meta,
      error: mongoErr.message,
      fix:   'Check MongoDB connection string, network connectivity, and Atlas IP whitelist',
    })
    return new AppError('DB_NETWORK_ERROR', 'Database connection error', 503, { meta })
  }

  // ── MongooseServerSelectionError — can't reach any server ─────────────────
  if (mongoErr?.name === 'MongooseServerSelectionError' || mongoErr?.name === 'MongoServerSelectionError') {
    logger.error('db.error', `ServerSelectionError in ${operation} — no MongoDB server reachable`, {
      ...meta,
      error: mongoErr.message,
      fix:   'Verify MONGO_URI host, port, credentials, and that the MongoDB server is running',
    })
    return new AppError('DB_NETWORK_ERROR', 'Cannot reach database', 503, { meta })
  }

  // ── MongooseError (generic) ────────────────────────────────────────────────
  if (err instanceof mongoose.Error) {
    logger.error('db.error', `MongooseError in ${operation}: ${(err as Error).message}`, {
      ...meta,
      stack: (err as Error).stack,
      fix:   'Check Mongoose model definition and query parameters',
    })
    return new AppError('INTERNAL_SERVER_ERROR', 'Database error', 500, { meta })
  }

  // ── Unknown error ──────────────────────────────────────────────────────────
  logger.error('db.error', `Unknown error in ${operation}: ${(err as Error)?.message ?? String(err)}`, {
    ...meta,
    stack: (err as Error)?.stack,
    fix:   'This is an unexpected error — check the stack trace above',
  })
  return new AppError('INTERNAL_SERVER_ERROR', 'Unexpected database error', 500, { meta })
}
