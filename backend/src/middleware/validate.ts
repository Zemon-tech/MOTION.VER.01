import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const error = new Error('Validation failed') as any
      error.status = 400
      error.code = 'VALIDATION_ERROR'
      error.details = result.error.flatten()
      return next(error)
    }
    req.body = result.data
    next()
  }
}


