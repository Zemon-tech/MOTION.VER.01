/**
 * Typed API error class.
 * Every error thrown by the api() client is an instance of this class,
 * so components can branch on .code without string-matching .message.
 */

export class ApiError extends Error {
  readonly code: string
  readonly fields?: Record<string, string>
  readonly requestId?: string
  readonly statusCode: number

  constructor(
    code: string,
    message: string,
    statusCode: number,
    fields?: Record<string, string>,
    requestId?: string,
  ) {
    super(message)
    this.name       = 'ApiError'
    this.code       = code
    this.statusCode = statusCode
    this.fields     = fields
    this.requestId  = requestId
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

export function isNetworkError(err: unknown): boolean {
  return isApiError(err) && err.code === 'NETWORK_ERROR'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the field-level error message for a specific field, if present. */
export function getFieldError(err: unknown, field: string): string | undefined {
  if (!isApiError(err)) return undefined
  return err.fields?.[field]
}

/**
 * Returns the best human-readable message for any error.
 * Always returns a string — never throws.
 */
export function getErrorMessage(err: unknown): string {
  if (isApiError(err)) return err.message
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Something went wrong. Please try again.'
}

// ─── Known error codes ────────────────────────────────────────────────────────
// Mirrors the backend's error code constants so components can import and
// compare without magic strings.

export const ErrorCodes = {
  // Auth
  WRONG_PASSWORD:    'WRONG_PASSWORD',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS', // backend alias
  USER_NOT_FOUND:    'USER_NOT_FOUND',
  EMAIL_TAKEN:       'EMAIL_TAKEN',
  CONFLICT:          'CONFLICT',              // backend alias for EMAIL_TAKEN
  TOKEN_EXPIRED:     'TOKEN_EXPIRED',
  TOKEN_MISSING:     'TOKEN_MISSING',
  TOKEN_INVALID:     'TOKEN_INVALID',
  TOKEN_MALFORMED:   'TOKEN_MALFORMED',
  UNAUTHORIZED:      'UNAUTHORIZED',
  // Page
  NOT_FOUND:         'NOT_FOUND',
  FORBIDDEN:         'FORBIDDEN',
  FORBIDDEN_READ:    'FORBIDDEN_READ',
  FORBIDDEN_EDIT:    'FORBIDDEN_EDIT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  CONTENT_TOO_LARGE: 'CONTENT_TOO_LARGE',
  SLUG_TAKEN:        'SLUG_TAKEN',
  // Validation
  VALIDATION_ERROR:  'VALIDATION_ERROR',
  BAD_REQUEST:       'BAD_REQUEST',
  // General
  INTERNAL_ERROR:    'INTERNAL_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  RATE_LIMITED:      'RATE_LIMITED',
  NETWORK_ERROR:     'NETWORK_ERROR',
} as const
