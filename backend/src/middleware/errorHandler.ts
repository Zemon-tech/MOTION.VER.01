import type { Request, Response, NextFunction } from 'express'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = (err as any)?.status || 500
  const code = (err as any)?.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR')
  const message = (err as any)?.message || 'Unexpected error'
  const details = (err as any)?.details
  res.status(status).json({ error: { code, message, details } })
}


