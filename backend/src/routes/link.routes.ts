import { Router } from 'express'
import { getUrlMetadata, proxyImage } from '../controllers/link.controller'

const router = Router()

router.get('/metadata', getUrlMetadata)
router.get('/image', proxyImage)

export default router
