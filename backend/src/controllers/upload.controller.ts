import type { Request, Response, NextFunction } from 'express'

export async function uploadImage(req: Request, res: Response, next: NextFunction) {
  try {
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      const e = new Error('No file uploaded') as any
      e.status = 400
      e.code = 'VALIDATION_ERROR'
      return next(e)
    }
    const url = `/uploads/${file.filename}`
    res.status(201).json({ url })
  } catch (err) {
    next(err)
  }
}


