/**
 * Auth middleware — every failure mode produces a specific, actionable log.
 *
 * Failure taxonomy:
 *   TOKEN_MISSING   — no Authorization header at all
 *   TOKEN_MALFORMED — header present but not a valid JWT structure
 *   TOKEN_EXPIRED   — valid JWT, past exp claim
 *   TOKEN_INVALID   — valid structure, wrong signature (tampered) or other verify error
 */

import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { verifyAccessToken } from '../services/token.service'
import { logger, requestContext } from '../utils/logger'
import { AppError } from '../utils/appError'

function makeAuthError(code: string, message: string, fix?: string): AppError {
  return new AppError(code, message, 401, { fix })
}

// Decode without verifying — used only to extract userId for log context.
// The result is NEVER trusted for access control.
function unsafeDecode(token: string): { userId?: string; exp?: number } {
  try { return (jwt.decode(token) as any) ?? {} } catch { return {} }
}

export function auth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('Authorization')

  if (!header) {
    logger.warn('auth.middleware', 'Request missing Authorization header', {
      method: req.method, path: req.path,
      fix: 'Include "Authorization: Bearer <token>" header in the request',
    })
    return next(makeAuthError('TOKEN_MISSING', 'Authentication required.', 'Include Authorization: Bearer <token> header'))
  }

  if (!header.startsWith('Bearer ')) {
    logger.warn('auth.middleware', 'Authorization header has wrong format — expected "Bearer <token>"', {
      method: req.method, path: req.path,
      headerPrefix: header.slice(0, 10),
      fix: 'Authorization header must be in the format: Bearer <jwt_token>',
    })
    return next(makeAuthError('TOKEN_MALFORMED', 'Authentication token is invalid.'))
  }

  const token = header.slice(7)

  if (!token || token.trim() === '') {
    logger.warn('auth.middleware', 'Bearer token is empty', {
      method: req.method, path: req.path,
      fix: 'Provide a non-empty JWT after "Bearer "',
    })
    return next(makeAuthError('TOKEN_MISSING', 'Authentication required.'))
  }

  // Quick structural check — a JWT must have exactly 2 dots
  if ((token.match(/\./g) ?? []).length !== 2) {
    logger.warn('auth.middleware', 'Token is not a valid JWT structure (wrong number of segments)', {
      method: req.method, path: req.path,
      segments: token.split('.').length,
      fix: 'Ensure the token is a valid JWT (header.payload.signature)',
    })
    return next(makeAuthError('TOKEN_MALFORMED', 'Authentication token is invalid.'))
  }

  try {
    const decoded = verifyAccessToken(token)
    ;(req as any).user = decoded

    const ctx = requestContext.getStore()
    if (ctx) ctx.userId = decoded.userId

    next()
  } catch (err) {
    const claims = unsafeDecode(token)

    if (err instanceof jwt.TokenExpiredError) {
      logger.warn('auth.middleware', 'Access token expired', {
        userId:    claims.userId,
        expiredAt: err.expiredAt?.toISOString(),
        method:    req.method,
        path:      req.path,
        fix:       'Call POST /api/auth/refresh to obtain a new access token',
      })
      return next(makeAuthError('TOKEN_EXPIRED', 'Your session has expired. Please log in again.', 'Call POST /api/auth/refresh'))
    }

    if (err instanceof jwt.JsonWebTokenError) {
      // JsonWebTokenError covers: invalid signature, malformed, not before, etc.
      const isTampered = err.message.includes('invalid signature')
      logger.warn('auth.middleware', isTampered
        ? 'Access token has invalid signature — possible tampering'
        : `Access token verification failed: ${err.message}`, {
        userId: claims.userId,
        reason: err.message,
        method: req.method,
        path:   req.path,
        ip:     req.ip,
        fix:    'Token may be corrupted or tampered. User must log in again.',
      })
      return next(makeAuthError('TOKEN_INVALID', 'Authentication token is invalid.'))
    }

    // Unexpected error from jwt.verify (should not happen in practice)
    logger.error('auth.middleware', `Unexpected error during token verification: ${(err as Error).message}`, {
      method: req.method, path: req.path,
      stack:  (err as Error).stack,
      fix:    'Check JWT_ACCESS_SECRET is set correctly in .env',
    })
    return next(makeAuthError('TOKEN_INVALID', 'Authentication token is invalid.'))
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('Authorization')
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return next()

  try {
    const decoded = verifyAccessToken(token)
    ;(req as any).user = decoded
    const ctx = requestContext.getStore()
    if (ctx) ctx.userId = decoded.userId
  } catch (err) {
    // On optional routes, silently treat invalid/expired tokens as anonymous.
    // canRead() will gate access per resource.
    if (err instanceof jwt.TokenExpiredError) {
      logger.debug('auth.optionalAuth', 'Optional token expired — treating as anonymous', {
        path: req.path,
      })
    }
    // Do not call next(err) — this is intentionally silent
  }
  next()
}
