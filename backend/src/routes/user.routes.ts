import { Router } from 'express'
import { auth } from '../middleware/auth'
import { health, me, getLastPage, upsertRecentVisited, getRecentVisited, clearSharedLinks } from '../controllers/user.controller'

const router = Router()

router.get('/health', health)
router.get('/me', auth, me)
router.get('/last-page', auth, getLastPage)
router.post('/recent-visited', auth, upsertRecentVisited)
router.get('/recent-visited', auth, getRecentVisited)
router.post('/clear-shared', auth, clearSharedLinks)

export default router


