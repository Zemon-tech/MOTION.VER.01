/**
 * Attaches a unique requestId to every HTTP request via AsyncLocalStorage.
 * Also handles 404 (route not found) and 405 (method not allowed) with logging.
 *
 * requestId format: req_<8 random hex chars>  e.g. req_a1b2c3d4
 */

import type { Request, Response, NextFunction } from 'express'
import { randomBytes } from 'crypto'
import { requestContext, logger } from '../utils/logger'
import { AppError } from '../utils/appError'

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = `req_${randomBytes(4).toString('hex')}`
  res.setHeader('X-Request-Id', id)

  const userId: string | undefined = (req as any).user?.userId

  requestContext.run({ requestId: id, userId, ip: req.ip }, next)
}

/** Must be registered AFTER all routes — catches unmatched paths */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  logger.warn('http.notFound', `Route not found: ${req.method} ${req.path}`, {
    method: req.method,
    path:   req.path,
    ip:     req.ip,
    fix:    'Check the API route exists and the URL is correct',
  })
  next(new AppError('NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404))
}
