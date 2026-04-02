/**
 * Structured logger — zero external dependencies.
 *
 * Dev:  coloured, human-readable lines to stdout
 * Prod: one JSON object per line (Datadog / CloudWatch compatible)
 *
 * Every line carries: timestamp, level, requestId, userId, action, message, meta.
 * requestId and userId are pulled from AsyncLocalStorage automatically — callers
 * never need to thread them through function arguments.
 */

import { AsyncLocalStorage } from 'async_hooks'

// ─── Request context ─────────────────────────────────────────────────────────

export interface RequestContext {
  requestId: string
  userId?: string
  ip?: string
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

// ─── Types ───────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  requestId: string
  userId?: string
  action: string
  message: string
  meta?: Record<string, unknown>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === 'production'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? (IS_PROD ? 'info' : 'debug')

const COLOURS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info:  '\x1b[32m', // green
  warn:  '\x1b[33m', // yellow
  error: '\x1b[31m', // red
}
const RESET = '\x1b[0m'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL]
}

function buildEntry(
  level: LogLevel,
  action: string,
  message: string,
  meta?: Record<string, unknown>,
): LogEntry {
  const ctx = requestContext.getStore()
  return {
    timestamp: new Date().toISOString(),
    level,
    requestId: ctx?.requestId ?? 'no-req',
    ...(ctx?.userId ? { userId: ctx.userId } : {}),
    action,
    message,
    ...(meta && Object.keys(meta).length ? { meta } : {}),
  }
}

function write(entry: LogEntry): void {
  if (IS_PROD) {
    // One JSON line — parseable by any log aggregator
    process.stdout.write(JSON.stringify(entry) + '\n')
    return
  }

  // Pretty dev output
  const colour = COLOURS[entry.level]
  const level  = `${colour}${entry.level.toUpperCase().padEnd(5)}${RESET}`
  const ts     = entry.timestamp.slice(11, 23) // HH:MM:SS.mmm
  const rid    = `\x1b[2m${entry.requestId}\x1b[0m`
  const uid    = entry.userId ? ` uid=${entry.userId}` : ''
  const meta   = entry.meta ? ` ${JSON.stringify(entry.meta)}` : ''
  const line   = `${ts} ${level} [${entry.action}]${uid} ${entry.message}${meta} ${rid}`

  if (entry.level === 'error') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

function log(level: LogLevel, action: string, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return
  write(buildEntry(level, action, message, meta))
}

export const logger = {
  debug: (action: string, message: string, meta?: Record<string, unknown>) => log('debug', action, message, meta),
  info:  (action: string, message: string, meta?: Record<string, unknown>) => log('info',  action, message, meta),
  warn:  (action: string, message: string, meta?: Record<string, unknown>) => log('warn',  action, message, meta),
  error: (action: string, message: string, meta?: Record<string, unknown>) => log('error', action, message, meta),
}

// ─── Sensitive-data helpers ───────────────────────────────────────────────────

/** tab***@gmail.com */
export function redactEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 0) return '***'
  const local  = email.slice(0, at)
  const domain = email.slice(at)          // includes the @
  const visible = local.slice(0, Math.min(3, local.length))
  return `${visible}***${domain}`
}

/** abc123... (first 6 chars only) */
export function redactToken(token: string): string {
  return token.slice(0, 6) + '...'
}
