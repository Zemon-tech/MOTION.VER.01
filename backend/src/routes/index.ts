import { Router } from 'express'
import authRoutes from './auth.routes'
import userRoutes from './user.routes'
import pageRoutes from './page.routes'
import uploadRoutes from './upload.routes'
import linkRoutes from './link.routes'

const router = Router()

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Backend is working!' })
})

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/pages', pageRoutes)
router.use('/uploads', uploadRoutes)
router.use('/links', linkRoutes)

export default router


