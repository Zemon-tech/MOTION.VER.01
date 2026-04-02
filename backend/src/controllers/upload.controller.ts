import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { AppError } from '../utils/appError'

export async function uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.userId as string | undefined
    const file   = (req as any).file as Express.Multer.File | undefined

    if (!file) {
      logger.warn('upload.image', 'Upload request received with no file attached', {
        userId,
        contentType: req.headers['content-type'],
        fix: 'Send the file as multipart/form-data with field name "file"',
      })
      return next(new AppError('FILE_MISSING', 'No file was uploaded', 400, {
        fix: 'Send the file as multipart/form-data with field name "file"',
      }))
    }

    // Validate MIME type (belt-and-suspenders — multer fileFilter already checks)
    if (!file.mimetype.startsWith('image/')) {
      logger.warn('upload.image', 'Rejected non-image file upload', {
        userId,
        mimetype:     file.mimetype,
        originalname: file.originalname,
        fix: 'Only image/* MIME types are accepted',
      })
      return next(new AppError('FILE_TYPE_REJECTED', 'Only image files are allowed', 415))
    }

    const url = `/uploads/${file.filename}`

    logger.info('upload.image', 'Image uploaded successfully', {
      userId,
      filename:     file.filename,
      originalname: file.originalname,
      mimetype:     file.mimetype,
      sizeBytes:    file.size,
      url,
    })

    res.status(201).json({ url })
  } catch (err) {
    logger.error('upload.image', `Unexpected error during image upload: ${(err as Error).message}`, {
      userId: (req as any).user?.userId,
      stack:  (err as Error).stack,
      fix:    'Check disk permissions on the uploads directory and available disk space',
    })
    next(err)
  }
}
