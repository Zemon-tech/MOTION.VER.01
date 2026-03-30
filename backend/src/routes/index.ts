import { Router } from 'express'
import authRoutes from './auth.routes'
import userRoutes from './user.routes'
import pageRoutes from './page.routes'
import uploadRoutes from './upload.routes'
import linkRoutes from './link.routes'
import googleRoutes from './google.routes'
import todoRoutes from './todo.routes'

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
router.use('/google', googleRoutes)
router.use('/todos', todoRoutes)

export default router
