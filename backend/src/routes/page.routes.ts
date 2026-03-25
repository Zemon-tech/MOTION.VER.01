import { Router } from 'express'
import { auth, optionalAuth } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { createPageSchema, createSubpageSchema, updatePageSchema, updatePrivacySchema, shareSchema, updateLockSchema, verifyLockSchema } from '../schemas/page.schema'
import { createPage, listMyPages, listPublicPages, getPage, getPageBySlug, updatePage, updatePrivacy, sharePage, deletePage, starPage, unstarPage, listSharedPages, claimLink, listSharedByMe, listCollaborators, inviteCollaborator, removeCollaborator, updateCollaboratorRole, createSubpage, getAncestors, getPagesMeta, updateLock, verifyLock } from '../controllers/page.controller'

const router = Router()

router.post('/', auth, validateBody(createPageSchema), createPage)
router.post('/:id/subpages', auth, validateBody(createSubpageSchema), createSubpage)
router.get('/', auth, listMyPages)
router.get('/public', optionalAuth, listPublicPages)
router.get('/meta', optionalAuth, getPagesMeta)
router.get('/shared', auth, listSharedPages)
router.get('/shared-by-me', auth, listSharedByMe)
router.get('/slug/:slug', optionalAuth, getPageBySlug)
router.get('/:id', optionalAuth, getPage)
router.get('/:id/ancestors', optionalAuth, getAncestors)
router.patch('/:id', auth, validateBody(updatePageSchema), updatePage)
router.patch('/:id/privacy', auth, validateBody(updatePrivacySchema), updatePrivacy)
router.patch('/:id/share', auth, validateBody(shareSchema), sharePage)
router.patch('/:id/lock', auth, validateBody(updateLockSchema), updateLock)
router.post('/:id/verify-lock', optionalAuth, validateBody(verifyLockSchema), verifyLock)
router.post('/:id/claim-link', auth, claimLink)
router.get('/:id/collaborators', auth, listCollaborators)
router.post('/:id/invite', auth, inviteCollaborator)
router.delete('/:id/collaborators/:userId', auth, removeCollaborator)
router.patch('/:id/collaborators/:userId', auth, updateCollaboratorRole)
router.delete('/:id', auth, deletePage)
router.post('/:id/star', auth, starPage)
router.delete('/:id/star', auth, unstarPage)

export default router


