import { Router } from 'express'
import { validateBody } from '../middleware/validate'
import { signupSchema, loginSchema } from '../schemas/auth.schema'
import { signup, login, refresh, logout } from '../controllers/auth.controller'

const router = Router()

router.post('/signup', validateBody(signupSchema), signup)
router.post('/login', validateBody(loginSchema), login)
router.post('/refresh', refresh)
router.post('/logout', logout)

export default router


