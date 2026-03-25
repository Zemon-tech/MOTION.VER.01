import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { auth } from '../middleware/auth'
import { uploadImage } from '../controllers/upload.controller'

const router = Router()

const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname) || '.bin'
    cb(null, `${unique}${ext}`)
  },
})

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true)
  else cb(new Error('Only image files are allowed'))
}

const maxSize = Number(process.env.FILE_MAX_SIZE_BYTES || 5 * 1024 * 1024)
const upload = multer({ storage, fileFilter, limits: { fileSize: maxSize } })

router.post('/images', auth, upload.single('file'), uploadImage)

export default router


