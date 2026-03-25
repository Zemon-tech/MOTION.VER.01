import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../services/token.service'

export function auth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  
  if (!token) {
    const err = new Error('Unauthorized') as any
    err.status = 401
    err.code = 'UNAUTHORIZED'
    return next(err)
  }
  
  try {
    const decoded = verifyAccessToken(token)
    ;(req as any).user = decoded
    next()
  } catch (error) {
    const err = new Error('Unauthorized') as any
    err.status = 401
    err.code = 'UNAUTHORIZED'
    return next(err)
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return next()
  try {
    const decoded = verifyAccessToken(token)
    ;(req as any).user = decoded
  } catch {
    // ignore invalid token on optional auth
  }
  next()
}


