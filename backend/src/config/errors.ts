/**
 * Typed error codes and their client-safe messages.
 *
 * Every error that leaves the server must use one of these codes.
 * This file is the single source of truth — errorHandler.ts reads from it.
 */

export const ErrorCode = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  TOKEN_MISSING:          'TOKEN_MISSING',
  TOKEN_EXPIRED:          'TOKEN_EXPIRED',
  TOKEN_INVALID:          'TOKEN_INVALID',
  TOKEN_MALFORMED:        'TOKEN_MALFORMED',
  UNAUTHORIZED:           'UNAUTHORIZED',
  INVALID_CREDENTIALS:    'INVALID_CREDENTIALS',
  WRONG_PASSWORD:         'WRONG_PASSWORD',
  USER_NOT_FOUND:         'USER_NOT_FOUND',
  EMAIL_TAKEN:            'EMAIL_TAKEN',

  // ── Authorization ───────────────────────────────────────────────────────────
  FORBIDDEN:              'FORBIDDEN',
  LOCKED:                 'LOCKED',
  INVALID_PASSWORD:       'INVALID_PASSWORD',

  // ── Validation ──────────────────────────────────────────────────────────────
  VALIDATION_ERROR:       'VALIDATION_ERROR',
  BAD_REQUEST:            'BAD_REQUEST',

  // ── Resources ───────────────────────────────────────────────────────────────
  NOT_FOUND:              'NOT_FOUND',
  CONFLICT:               'CONFLICT',
  SLUG_TAKEN:             'SLUG_TAKEN',

  // ── Content ─────────────────────────────────────────────────────────────────
  CONTENT_TOO_LARGE:      'CONTENT_TOO_LARGE',
  PAYLOAD_TOO_LARGE:      'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',

  // ── Rate limiting ───────────────────────────────────────────────────────────
  RATE_LIMITED:           'RATE_LIMITED',
  TOO_MANY_REQUESTS:     'TOO_MANY_REQUESTS',

  // ── Upload ──────────────────────────────────────────────────────────────────
  FILE_MISSING:           'FILE_MISSING',
  FILE_TYPE_REJECTED:     'FILE_TYPE_REJECTED',
  FILE_TOO_LARGE:         'FILE_TOO_LARGE',
  UPLOAD_FAILED:          'UPLOAD_FAILED',

  // ── Database ────────────────────────────────────────────────────────────────
  DB_CAST_ERROR:          'DB_CAST_ERROR',
  DB_VALIDATION_ERROR:    'DB_VALIDATION_ERROR',
  DB_DUPLICATE_KEY:       'DB_DUPLICATE_KEY',
  DB_NOT_FOUND:           'DB_NOT_FOUND',
  DB_NETWORK_ERROR:       'DB_NETWORK_ERROR',
  DB_TIMEOUT:             'DB_TIMEOUT',
  DB_VERSION_ERROR:       'DB_VERSION_ERROR',
  DB_WRITE_CONCERN:       'DB_WRITE_CONCERN',

  // ── Server ──────────────────────────────────────────────────────────────────
  INTERNAL_SERVER_ERROR:  'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE:    'SERVICE_UNAVAILABLE',
} as const

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode]

// ─── Client-safe messages ─────────────────────────────────────────────────────
// These are the ONLY messages that reach the client for sensitive codes.
// Never expose internal details, stack traces, or DB error messages.

export const CLIENT_MESSAGES: Partial<Record<ErrorCode, string>> = {
  TOKEN_MISSING:          'Authentication required.',
  TOKEN_EXPIRED:          'Your session has expired. Please log in again.',
  TOKEN_INVALID:          'Authentication token is invalid. Please log in again.',
  TOKEN_MALFORMED:        'Authentication token is invalid. Please log in again.',
  UNAUTHORIZED:           'Authentication required.',
  INVALID_CREDENTIALS:    'Invalid email or password.',
  WRONG_PASSWORD:         'Incorrect password. Please try again.',
  USER_NOT_FOUND:         'No account found with this email address.',
  EMAIL_TAKEN:            'An account with this email already exists.',
  FORBIDDEN:              'You do not have permission to perform this action.',
  LOCKED:                 'This page is password-protected.',
  INVALID_PASSWORD:       'Incorrect password.',
  DB_CAST_ERROR:          'Invalid ID format.',
  DB_DUPLICATE_KEY:       'A record with this value already exists.',
  SLUG_TAKEN:             'This page URL is already in use. Please choose a different one.',
  TOO_MANY_REQUESTS:     'Too many requests. Please slow down and try again.',
  DB_NETWORK_ERROR:       'A database error occurred. Please try again.',
  DB_TIMEOUT:             'The request timed out. Please try again.',
  DB_VERSION_ERROR:       'This record was modified by another request. Please refresh and try again.',
  CONTENT_TOO_LARGE:      'Page content exceeds the maximum allowed size.',
  PAYLOAD_TOO_LARGE:      'Request body is too large.',
  FILE_TOO_LARGE:         'File exceeds the maximum allowed size.',
  FILE_TYPE_REJECTED:     'Only image files are allowed.',
  UPLOAD_FAILED:          'File upload failed. Please try again.',
  INTERNAL_SERVER_ERROR:  'An unexpected error occurred. Please try again.',
  SERVICE_UNAVAILABLE:    'Service temporarily unavailable. Please try again shortly.',
}

// ─── Operational codes ────────────────────────────────────────────────────────
// Operational = expected failure (wrong password, not found, validation).
// Non-operational = programmer error (null ref, DB crash, unhandled promise).
// Operational errors get warn-level logs; non-operational get error-level + stack.

export const OPERATIONAL_CODES = new Set<string>([
  ErrorCode.TOKEN_MISSING,
  ErrorCode.TOKEN_EXPIRED,
  ErrorCode.TOKEN_INVALID,
  ErrorCode.TOKEN_MALFORMED,
  ErrorCode.UNAUTHORIZED,
  ErrorCode.INVALID_CREDENTIALS,
  ErrorCode.WRONG_PASSWORD,
  ErrorCode.USER_NOT_FOUND,
  ErrorCode.EMAIL_TAKEN,
  ErrorCode.FORBIDDEN,
  ErrorCode.LOCKED,
  ErrorCode.INVALID_PASSWORD,
  ErrorCode.VALIDATION_ERROR,
  ErrorCode.BAD_REQUEST,
  ErrorCode.NOT_FOUND,
  ErrorCode.CONFLICT,
  ErrorCode.CONTENT_TOO_LARGE,
  ErrorCode.PAYLOAD_TOO_LARGE,
  ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  ErrorCode.RATE_LIMITED,
  ErrorCode.TOO_MANY_REQUESTS,
  ErrorCode.SLUG_TAKEN,
  ErrorCode.FILE_MISSING,
  ErrorCode.FILE_TYPE_REJECTED,
  ErrorCode.FILE_TOO_LARGE,
  ErrorCode.DB_CAST_ERROR,
  ErrorCode.DB_DUPLICATE_KEY,
  ErrorCode.DB_NOT_FOUND,
  ErrorCode.DB_VERSION_ERROR,
])
