/**
 * Zod validation middleware with field-level human-readable errors.
 *
 * Every failure logs: endpoint, which fields failed, what was expected.
 * Sensitive fields (password, token) are never logged.
 */

import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema, ZodIssue } from 'zod'
import { logger } from '../utils/logger'
import { AppError } from '../utils/appError'

// Fields whose values must never appear in logs
const SENSITIVE_FIELDS = new Set(['password', 'passwordHash', 'token', 'refreshToken', 'secret', 'lockPassword'])

function humanise(issue: ZodIssue): string {
  if (issue.message && issue.message !== 'Invalid input') return issue.message
  switch (issue.code) {
    case 'too_small':
      return issue.type === 'string'
        ? `Must be at least ${issue.minimum} character${issue.minimum === 1 ? '' : 's'}`
        : `Must be at least ${issue.minimum}`
    case 'too_big':
      return issue.type === 'string'
        ? `Must be no more than ${issue.maximum} characters`
        : `Must be no more than ${issue.maximum}`
    case 'invalid_string':
      if (issue.validation === 'email') return 'Please enter a valid email address'
      if (issue.validation === 'url')   return 'Please enter a valid URL'
      if (issue.validation === 'datetime') return 'Must be a valid ISO 8601 date-time'
      return 'Invalid format'
    case 'invalid_type':
      return issue.received === 'undefined' ? 'This field is required' : `Expected ${issue.expected}, received ${issue.received}`
    case 'invalid_enum_value':
      return `Must be one of: ${issue.options.join(', ')}`
    case 'invalid_literal':
      return `Must be exactly: ${JSON.stringify(issue.expected)}`
    default:
      return issue.message || 'Invalid value'
  }
}

function safeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_FIELDS.has(key)) return '[redacted]'
  if (typeof value === 'string' && value.length > 100) return value.slice(0, 100) + '...'
  return value
}

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (result.success) {
      req.body = result.data
      return next()
    }

    const fields: Record<string, string> = {}
    const loggedValues: Record<string, unknown> = {}

    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_root'
      if (!fields[key]) {
        fields[key] = humanise(issue)
        // Log the received value (redacted if sensitive) for debugging
        const leafKey = issue.path[issue.path.length - 1]
        const rawValue = issue.path.reduce((obj: any, k) => obj?.[k], req.body)
        loggedValues[key] = safeValue(String(leafKey ?? key), rawValue)
      }
    }

    logger.warn('validate.body', `Validation failed on ${req.method} ${req.path}`, {
      endpoint: `${req.method} ${req.path}`,
      fields,
      received: loggedValues,
    })

    next(new AppError('VALIDATION_ERROR', 'Validation failed', 400, { fields }))
  }
}
