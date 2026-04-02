import type { Request, Response, NextFunction } from 'express'
import { Page } from '../db/models/Page'
import { makeSlug, extractIdFromSlug } from '../utils/slug'
import RedisService from '../services/redis.service'
import crypto from 'crypto'
import { User } from '../db/models/User'
import { canRead, canEdit, isTokenValid, sanitizePage } from '../services/perm.service'
import { emitSubpageMetaToAncestors, emitSubpageDeletedToAncestors } from '../services/socketHub'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { logger, redactEmail } from '../utils/logger'

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }
const CONTENT_SIZE_LIMIT = 1 * 1024 * 1024

function contentBytes(content: unknown): number {
  try { return Buffer.byteLength(JSON.stringify(content), 'utf8') } catch { return 0 }
}


// ─── Lock ─────────────────────────────────────────────────────────────────────

export async function updateLock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id     = req.params.id as string
    const userId = (req as any).user?.userId as string
    const { locked, password } = req.body as { locked: boolean; password?: string }
    const page = await Page.findById(id)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (String(page.ownerId) !== String(userId)) {
      logger.warn('page.updateLock', 'Forbidden — not owner', { userId, pageId: id })
      return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    }
    ;(page as any).locked = !!locked
    if (locked) {
      if (!password && !(page as any).lockPasswordHash)
        return void res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Password required to lock' } })
      if (password) (page as any).lockPasswordHash = await bcrypt.hash(password, await bcrypt.genSalt(10))
    } else {
      ;(page as any).lockPasswordHash = undefined as any
    }
    await page.save()
    logger.info('page.updateLock', locked ? 'Page locked' : 'Page unlocked', { userId, pageId: id })
    res.json({ ok: true, page: { _id: String(page._id), locked: (page as any).locked } })
  } catch (err) { next(err) }
}

export async function verifyLock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string
    const { password } = req.body as { password: string }
    const page = await Page.findById(id).select('_id locked lockPasswordHash')
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (!(page as any).locked) return void res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Page not locked' } })
    const ok = (page as any).lockPasswordHash ? await bcrypt.compare(password, (page as any).lockPasswordHash) : false
    if (!ok) {
      logger.warn('page.verifyLock', 'Invalid lock password attempt', { pageId: id, ip: req.ip })
      return void res.status(401).json({ error: { code: 'INVALID_PASSWORD', message: 'Invalid password' } })
    }
    const token = jwt.sign({ sub: String(page._id), typ: 'unlock' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' })
    logger.info('page.verifyLock', 'Lock verified — unlock token issued', { pageId: id })
    res.json({ ok: true, unlock: token })
  } catch (err) { next(err) }
}

// ─── Meta / ancestors ─────────────────────────────────────────────────────────

export async function getPagesMeta(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId   = (req as any).user?.userId || null
    const idsParam = (req.query.ids as string | undefined) || ''
    const ids      = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50)
    if (!ids.length) return void res.json({ pages: [] })
    const docs  = await Page.find({ _id: { $in: ids } })
      .select('_id title slug icon ownerId isPublic shareToken linkExpiresAt sharedWith collaborators').lean()
    const token = typeof req.query.t === 'string' ? req.query.t : undefined
    const pages = docs
      .filter((d: any) => canRead(userId, d, token))
      .map((d: any) => ({ _id: String(d._id), title: d.title, slug: d.slug || makeSlug(d.title, String(d._id)), icon: d.icon || null }))
    res.json({ pages })
  } catch (err) { next(err) }
}

export async function getAncestors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id     = req.params.id as string
    const userId = (req as any).user?.userId || null
    const page   = await Page.findById(id).lean()
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (!canRead(userId, page, undefined)) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const ancestorIds: string[] = Array.isArray((page as any).ancestors) ? (page as any).ancestors.map((a: any) => String(a)) : []
    if (!ancestorIds.length) return void res.json({ ancestors: [] })
    const docs = await Page.find({ _id: { $in: ancestorIds } }).select('_id title slug icon parentId').lean()
    const byId = new Map<string, any>()
    for (const d of docs) byId.set(String((d as any)._id), d)
    res.json({ ancestors: ancestorIds.map((aid) => byId.get(aid)).filter(Boolean) })
  } catch (err) { next(err) }
}

// ─── Shared pages ─────────────────────────────────────────────────────────────

export async function listSharedByMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.userId
    if (!userId) return void res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    const pages = await Page.find({ ownerId: userId }).select('_id title slug isPublic linkEditEnabled collaborators updatedAt').lean()
    const shared = pages.filter((p: any) => {
      const collabEditors = Array.isArray(p.collaborators) && p.collaborators.some((c: any) => c.role === 'editor')
      return collabEditors || (!!p.isPublic && !!p.linkEditEnabled)
    })
    res.json({ pages: shared })
  } catch (err) { next(err) }
}

export async function listCollaborators(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.userId
    const id     = req.params.id as string
    const page   = await Page.findById(id).lean()
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (String(page.ownerId) !== String(userId)) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const owner = await User.findById(page.ownerId).select('_id email name avatarUrl').lean()
    const collabMap: Record<string, { _id: string; email: string; name?: string; role: 'viewer' | 'editor' }> = {}
    for (const c of (Array.isArray(page.collaborators) ? page.collaborators : [])) {
      const u = await User.findById(c.userId).select('_id email name').lean()
      if (u) collabMap[String(u._id)] = { _id: String(u._id), email: u.email as string, name: u.name as any, role: c.role }
    }
    for (const uid of (Array.isArray(page.sharedWith) ? page.sharedWith : [])) {
      const idStr = String(uid)
      if (!collabMap[idStr]) {
        const u = await User.findById(idStr).select('_id email name').lean()
        if (u) collabMap[idStr] = { _id: String(u._id), email: u.email as string, name: u.name as any, role: 'editor' }
      }
    }
    res.json({ owner, collaborators: Object.values(collabMap) })
  } catch (err) { next(err) }
}

export async function inviteCollaborator(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.userId
    const id     = req.params.id as string
    const { email } = req.body as { email: string }
    if (!email) return void res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'email required' } })
    const page = await Page.findById(id)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (String(page.ownerId) !== String(userId)) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } })
    const uid = user._id.toString()
    const existingLegacy = Array.isArray(page.sharedWith) && (page.sharedWith as any[]).some((u: any) => String(u) === uid)
    const existingCollab = Array.isArray((page as any).collaborators) && (page as any).collaborators.some((c: any) => String(c.userId) === uid)
    if (!existingLegacy && !existingCollab) {
      ;(page as any).collaborators = Array.isArray((page as any).collaborators) ? (page as any).collaborators : []
      ;(page as any).collaborators.push({ userId: user._id, role: 'editor' })
      await page.save()
    }
    logger.info('page.inviteCollaborator', 'Collaborator invited', { pageId: id, invitedEmail: redactEmail(email), byUserId: userId })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function removeCollaborator(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId       = (req as any).user?.userId
    const id           = req.params.id as string
    const targetUserId = req.params.userId as string
    const page = await Page.findById(id)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (String(page.ownerId) !== String(userId)) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    page.sharedWith = (page.sharedWith || []).filter((u: any) => String(u) !== String(targetUserId)) as any
    ;(page as any).collaborators = Array.isArray((page as any).collaborators)
      ? (page as any).collaborators.filter((c: any) => String(c.userId) !== String(targetUserId))
      : []
    await page.save()
    logger.info('page.removeCollaborator', 'Collaborator removed', { pageId: id, targetUserId, byUserId: userId })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function updateCollaboratorRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId       = (req as any).user?.userId
    const id           = req.params.id as string
    const targetUserId = req.params.userId as string
    const { role }     = req.body as { role: 'viewer' | 'editor' }
    if (!['viewer', 'editor'].includes(role)) return void res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid role' } })
    const page = await Page.findById(id)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (String(page.ownerId) !== String(userId)) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    ;(page as any).collaborators = Array.isArray((page as any).collaborators) ? (page as any).collaborators : []
    const idx = (page as any).collaborators.findIndex((c: any) => String(c.userId) === String(targetUserId))
    if (idx === -1) { (page as any).collaborators.push({ userId: targetUserId as any, role }) }
    else { (page as any).collaborators[idx].role = role }
    await page.save()
    logger.info('page.updateCollaboratorRole', 'Collaborator role updated', { pageId: id, targetUserId, role, byUserId: userId })
    res.json({ ok: true })
  } catch (err) { next(err) }
}


// ─── Shared links ─────────────────────────────────────────────────────────────

export async function listSharedPages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.userId
    if (!userId) return void res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    const user = await User.findById(userId).select('sharedLinks sharedBlocked').lean()
    const linkShares: any[] = Array.isArray((user as any)?.sharedLinks) ? (user as any).sharedLinks : []
    const collabPages = await Page.find({ $or: [{ 'collaborators.userId': userId }, { sharedWith: userId }] })
      .select('_id title slug ownerId updatedAt createdAt').lean()
    const ownerIds = Array.from(new Set(collabPages.map((p: any) => String(p.ownerId))))
    const owners   = ownerIds.length ? await User.find({ _id: { $in: ownerIds } }).select('_id name email').lean() : []
    const ownerMap = new Map<string, { name?: string; email?: string }>()
    for (const o of owners) ownerMap.set(String(o._id), { name: o.name as any, email: o.email as any })
    const collabShares = collabPages
      .filter((p: any) => String(p.ownerId) !== String(userId))
      .map((p: any) => {
        const owner = ownerMap.get(String(p.ownerId))
        return { pageId: p._id, slug: p.slug || makeSlug(p.title, String(p._id)), token: null, title: p.title, ownerId: p.ownerId, ownerName: owner?.name || owner?.email || 'Owner', addedAt: (p.updatedAt || p.createdAt || new Date()).toISOString() }
      })
    const combined = [...linkShares, ...collabShares]
    const seen = new Set<string>()
    let deduped = combined.filter((s: any) => {
      const key = `${String(s.pageId)}|${s.token || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    try {
      const ids = Array.from(new Set(deduped.map((s: any) => String(s.pageId))))
      if (ids.length) {
        const pages = await Page.find({ _id: { $in: ids } }).select('_id icon').lean()
        const iconMap = new Map<string, string | null>()
        for (const p of pages) iconMap.set(String((p as any)._id), (p as any).icon || null)
        deduped = deduped.map((s: any) => ({ ...s, icon: s.icon ?? iconMap.get(String(s.pageId)) ?? null }))
      }
    } catch {}
    res.json({ shared: deduped })
  } catch (err) { next(err) }
}

export async function claimLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.userId
    const pageId = req.params.id as string
    const { token } = req.body as { token?: string | null }
    if (!userId) return void res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    if (!pageId || !token) return void res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'pageId and token required' } })
    const page = await Page.findById(pageId)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (!canEdit(userId, page.toObject(), token)) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const user = await User.findById(userId)
    if (!user) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } })
    const blocked = Array.isArray((user as any).sharedBlocked) && (user as any).sharedBlocked.some((b: any) => String(b.pageId) === String(page._id))
    if (blocked) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Shared page cleared by user' } })
    const slug = page.slug || makeSlug(page.title, page._id.toString())
    const arr: any[] = Array.isArray((user as any).sharedLinks) ? (user as any).sharedLinks : []
    const exists = arr.some((e: any) => String(e.pageId) === String(page._id) && e.token === token)
    if (!exists) {
      const owner = await User.findById(page.ownerId).select('_id name email').lean()
      arr.push({ pageId: page._id, slug, token, title: page.title, ownerId: page.ownerId, ownerName: owner?.name || owner?.email || 'Owner', addedAt: new Date() })
      ;(user as any).sharedLinks = arr
      await user.save()
    }
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId    = (req as any).user.userId as string
    const { title, content } = req.body as { title?: string; content?: any }
    const pageTitle = title || 'Untitled'

    if (content) {
      const size = contentBytes(content)
      if (size > CONTENT_SIZE_LIMIT) {
        logger.warn('page.create', 'Content too large', { userId, sizeBytes: size, limitBytes: CONTENT_SIZE_LIMIT })
        return void res.status(413).json({ error: { code: 'CONTENT_TOO_LARGE', message: 'Page content exceeds the 1 MB limit.' } })
      }
    }

    const slug = makeSlug(pageTitle, new Date().getTime().toString())
    const page = await Page.create({ ownerId: userId, title: pageTitle, content: content || EMPTY_DOC, slug })
    logger.info('page.create', 'Page created', { userId, pageId: String(page._id), title: pageTitle })
    res.status(201).json({ page, slug: page.slug })
  } catch (err) { next(err) }
}

export async function listMyPages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.userId as string | undefined
    if (!userId) return void res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User ID not found in token' } })
    const dbPages = await Page.find({ ownerId: userId }).sort({ createdAt: -1 }).lean()
    const pages = dbPages.map((page) => ({ ...page, slug: page.slug || makeSlug(page.title, page._id.toString()) }))
    res.json({ pages })
  } catch (err) { next(err) }
}

export async function listPublicPages(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pages = await Page.find({ isPublic: true }).sort({ createdAt: -1 }).lean()
    const safe = pages.map((p: any) => {
      const { shareToken, lockPasswordHash, __v, ...rest } = p
      return rest
    })
    res.json({ pages: safe })
  } catch (err) { next(err) }
}

export async function getPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id     = req.params.id as string
    const userId = (req as any).user?.userId || null
    let pageContent = id ? await RedisService.getPageContent(id) : null
    let page: any

    if (!pageContent) {
      page = await Page.findById(id)
      if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
      const token    = typeof req.query.t === 'string' ? String(req.query.t) : undefined
      const readable = canRead(userId, page.toObject(), token)
      if (!readable && !(page as any).locked) {
        logger.warn('page.get', 'Access denied', { userId, pageId: id, reason: 'not readable' })
        return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
      }
      if ((page as any).locked) {
        const isOwner = userId && page.ownerId.toString() === String(userId)
        if (!isOwner) {
          const unlock = req.headers['x-page-unlock'] as string | undefined
          if (!unlock) return void res.status(401).json({ error: { code: 'LOCKED', message: 'Page is locked', pageId: String(page._id) } })
          try {
            const payload = jwt.verify(unlock, process.env.JWT_SECRET || 'secret') as any
            if (!payload || payload.sub !== String(page._id)) return void res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String(page._id) } })
          } catch {
            return void res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String(page._id) } })
          }
        }
      }
      if (id) await RedisService.cachePageContent(id, page)
      pageContent = page
    } else {
      page = pageContent
      const token    = typeof req.query.t === 'string' ? String(req.query.t) : undefined
      const readable = canRead(userId, page, token)
      if (!readable && !(page as any).locked) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
      if ((page as any).locked) {
        const isOwner = userId && String((page as any).ownerId) === String(userId)
        if (!isOwner) {
          const unlock = req.headers['x-page-unlock'] as string | undefined
          if (!unlock) return void res.status(401).json({ error: { code: 'LOCKED', message: 'Page is locked', pageId: String((page as any)._id) } })
          try {
            const payload = jwt.verify(unlock, process.env.JWT_SECRET || 'secret') as any
            if (!payload || payload.sub !== String((page as any)._id)) return void res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String((page as any)._id) } })
          } catch {
            return void res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String((page as any)._id) } })
          }
        }
      }
    }

    if (userId) {
      await RedisService.cacheLastPage(userId, { id: page._id.toString(), title: page.title, slug: makeSlug(page.title, page._id.toString()), updatedAt: page.updatedAt })
    }

    const token       = typeof req.query.t === 'string' ? req.query.t : undefined
    const safePageObj = sanitizePage(page, userId)
    if (token) {
      const pageRaw = typeof (page as any).toObject === 'function' ? (page as any).toObject() : page
      safePageObj.canEdit = canEdit(userId, pageRaw, token)
    }
    logger.debug('page.get', 'Page fetched', { userId, pageId: String(page._id) })
    res.json({ page: safePageObj, slug: makeSlug(page.title, page._id.toString()) })
  } catch (err) { next(err) }
}

export async function updatePage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id     = req.params.id as string
    const userId = (req as any).user.userId as string
    const page   = await Page.findById(id)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (!canEdit(userId, page.toObject(), undefined)) {
      logger.warn('page.update', 'Update denied — no edit permission', { userId, pageId: id })
      return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    }

    const { title, content, coverImageUrl, coverPosition, icon } = req.body as any

    if (content !== undefined) {
      const size = contentBytes(content)
      if (size > CONTENT_SIZE_LIMIT) {
        logger.warn('page.update', 'Content too large', { userId, pageId: id, sizeBytes: size, limitBytes: CONTENT_SIZE_LIMIT })
        return void res.status(413).json({ error: { code: 'CONTENT_TOO_LARGE', message: 'Page content exceeds the 1 MB limit.' } })
      }
    }

    const changedFields: string[] = []
    const prevTitle = page.title
    const prevIcon  = (page as any).icon
    if (title !== undefined)          { page.title = title; page.slug = makeSlug(title, page._id.toString()); changedFields.push('title') }
    if (content !== undefined)        { page.content = content; changedFields.push('content') }
    if (coverImageUrl !== undefined)  { page.coverImageUrl = coverImageUrl; changedFields.push('coverImageUrl') }
    if (coverPosition !== undefined)  { page.coverPosition = coverPosition; changedFields.push('coverPosition') }
    if (icon !== undefined)           { (page as any).icon = icon; changedFields.push('icon') }
    await page.save()
    if (id) await RedisService.invalidatePageCache(id)

    logger.info('page.update', 'Page updated', {
      userId, pageId: id,
      changedFields,
      ...(content !== undefined ? { contentSizeBytes: contentBytes(content) } : {}),
    })

    try {
      const changed = (title !== undefined && title !== prevTitle) || (icon !== undefined && icon !== prevIcon)
      if (changed) {
        let targets = Array.isArray((page as any).ancestors) ? (page as any).ancestors.map((a: any) => String(a)) : []
        if (!targets.length && (page as any).parentId) targets = [String((page as any).parentId)]
        if (targets.length) emitSubpageMetaToAncestors(targets, { pageId: String(page._id), ...(title !== undefined ? { title } : {}), ...(icon !== undefined ? { icon } : {}) })
      }
    } catch {}

    res.json({ page, slug: page.slug })
  } catch (err) { next(err) }
}

export async function createSubpage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId   = (req as any).user.userId as string
    const parentId = req.params.id as string
    const { title } = req.body as { title?: string }
    const parent = await Page.findById(parentId)
    if (!parent) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Parent page not found' } })
    if (!canEdit(userId, parent.toObject(), undefined)) {
      logger.warn('page.createSubpage', 'Denied — no edit permission on parent', { userId, parentId })
      return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    }
    const pageTitle = title || 'Untitled'
    const slug      = makeSlug(pageTitle, new Date().getTime().toString())
    const ancestors = Array.isArray((parent as any).ancestors) ? [...(parent as any).ancestors, parent._id] : [parent._id]
    const sub = await Page.create({ ownerId: parent.ownerId, title: pageTitle, content: EMPTY_DOC, slug, parentId: parent._id, ancestors })
    logger.info('page.createSubpage', 'Subpage created', { userId, pageId: String(sub._id), parentId, title: pageTitle })
    res.status(201).json({ page: sub, slug: sub.slug })
  } catch (err) { next(err) }
}

export async function updatePrivacy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id     = req.params.id as string
    const userId = (req as any).user.userId as string
    const page   = await Page.findById(id)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (page.ownerId.toString() !== userId) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const { isPublic, linkEditEnabled, linkExpiresAt, rotateToken } = req.body as { isPublic: boolean; linkEditEnabled?: boolean; linkExpiresAt?: string | null; rotateToken?: boolean }
    page.isPublic = isPublic
    if (typeof linkEditEnabled === 'boolean') page.linkEditEnabled = linkEditEnabled
    if (linkExpiresAt !== undefined) (page as any).linkExpiresAt = linkExpiresAt ? new Date(linkExpiresAt) : null
    if (isPublic) {
      if (!page.shareToken || rotateToken) page.shareToken = crypto.randomBytes(12).toString('hex')
    } else {
      page.shareToken = undefined as any
    }
    await page.save()
    logger.info('page.updatePrivacy', 'Privacy updated', { userId, pageId: id, isPublic, linkEditEnabled })
    res.json({ page: { ...page.toObject(), shareToken: page.shareToken }, slug: makeSlug(page.title, page._id.toString()) })
  } catch (err) { next(err) }
}

export async function sharePage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id     = req.params.id as string
    const userId = (req as any).user.userId as string
    const page   = await Page.findById(id)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (page.ownerId.toString() !== userId) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const { userId: targetUserId, action } = req.body as { userId: string; action: 'add' | 'remove' }
    if (action === 'add') {
      if (!page.sharedWith.some((id) => id.toString() === targetUserId)) page.sharedWith.push(targetUserId as any)
    } else {
      page.sharedWith = page.sharedWith.filter((id) => id.toString() !== targetUserId)
    }
    await page.save()
    logger.info('page.share', `User ${action === 'add' ? 'added to' : 'removed from'} sharedWith`, { pageId: id, targetUserId, byUserId: userId })
    res.json({ page })
  } catch (err) { next(err) }
}

export async function deletePage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id     = req.params.id as string
    const userId = (req as any).user.userId as string
    const page   = await Page.findById(id)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (page.ownerId.toString() !== userId) {
      logger.warn('page.delete', 'Delete denied — not owner', { userId, pageId: id })
      return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    }
    try {
      const ancestors = Array.isArray((page as any).ancestors) ? (page as any).ancestors.map((a: any) => String(a)) : []
      if (ancestors.length) emitSubpageDeletedToAncestors(ancestors, { pageId: String(page._id) })
    } catch {}
    await Page.deleteMany({ $or: [{ _id: id }, { ancestors: id }] })
    logger.info('page.delete', 'Page deleted', { userId, pageId: id })
    res.status(204).send()
  } catch (err) { next(err) }
}

export async function getPageBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw    = String(req.params.slug || '')
    const userId = (req as any).user?.userId || null
    let token: string | null = null
    let slug = raw
    const dotIdx = raw.lastIndexOf('.')
    if (dotIdx > 0 && dotIdx < raw.length - 1) { slug = raw.slice(0, dotIdx); token = raw.slice(dotIdx + 1) }
    if (!token && typeof req.query.t === 'string') token = String(req.query.t)

    let page = await Page.findOne({ slug }).lean()
    if (!page) {
      const id = slug ? extractIdFromSlug(slug) : null
      if (id) page = await Page.findById(id).lean()
    }
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })

    const owner    = userId && page.ownerId.toString() === userId
    let readable   = canRead(userId, page, token || undefined)
    let editable   = canEdit(userId, page, token || undefined)

    // Inherit share token from public ancestor (Notion-like nested sharing)
    if (!readable && token) {
      try {
        let ancestorIds: string[] = Array.isArray((page as any).ancestors) ? (page as any).ancestors.map((a: any) => String(a)) : []
        if (!ancestorIds.length && (page as any).parentId) ancestorIds = [String((page as any).parentId)]
        if (ancestorIds.length) {
          const ancestors = await Page.find({ _id: { $in: ancestorIds } }).select('_id isPublic shareToken linkExpiresAt linkEditEnabled ownerId').lean()
          if (ancestors.find((ap: any) => !!ap?.isPublic && isTokenValid(ap, token))) readable = true
        }
      } catch {}
    }

    // Respect user's blocked list
    if (userId) {
      try {
        const u = await User.findById(userId).select('sharedBlocked').lean()
        const blocked = Array.isArray((u as any)?.sharedBlocked) && (u as any).sharedBlocked.some((b: any) => String(b.pageId) === String(page!._id))
        const isCollab = Array.isArray((page as any)?.collaborators) && (page as any).collaborators.some((c: any) => String(c.userId) === String(userId))
        if (blocked && !owner && !isCollab) { readable = false; editable = false }
      } catch {}
    }

    if (!readable && !(page as any).locked) {
      logger.warn('page.getBySlug', 'Access denied', {
        userId: userId || 'anonymous',
        slug,
        reason: 'not readable and not locked',
      })
      return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    }

    if ((page as any).locked) {
      const isOwner = userId && page.ownerId.toString() === String(userId)
      if (!isOwner) {
        const unlock = req.headers['x-page-unlock'] as string | undefined
        if (!unlock) {
          logger.info('page.getBySlug', 'Page is locked — unlock required', { userId: userId || 'anonymous', pageId: String(page._id) })
          return void res.status(401).json({ error: { code: 'LOCKED', message: 'Page is locked', pageId: String(page._id) } })
        }
        try {
          const payload = jwt.verify(unlock, process.env.JWT_SECRET || 'secret') as any
          if (!payload) return void res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String(page._id) } })
          let ancestorIds: string[] = Array.isArray((page as any).ancestors) ? (page as any).ancestors.map((a: any) => String(a)) : []
          if (!ancestorIds.length && (page as any).parentId) ancestorIds = [String((page as any).parentId)]
          const allowedIds = new Set<string>([String(page._id), ...ancestorIds])
          if (!allowedIds.has(String(payload.sub))) return void res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String(page._id) } })
        } catch {
          return void res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String(page._id) } })
        }
      }
    }

    const accessType = owner ? 'owner' : editable ? 'editor' : readable ? 'viewer' : 'public'
    logger.debug('page.getBySlug', 'Page fetched', { userId: userId || 'anonymous', pageId: String(page._id), slug, accessType })

    const pageWithSlug = { ...page, slug: page.slug || makeSlug(page.title, page._id.toString()), ...(owner ? {} : { shareToken: undefined }) }
    res.json({ page: pageWithSlug, canView: true, canEdit: !!editable, isOwner: !!owner })
  } catch (err) { next(err) }
}

export async function starPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id     = req.params.id as string
    const userId = (req as any).user.userId as string
    const page   = await Page.findById(id)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (!page.favoritedBy.some((u) => u.toString() === userId)) page.favoritedBy.push(userId as any)
    await page.save()
    res.status(204).send()
  } catch (err) { next(err) }
}

export async function unstarPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id     = req.params.id as string
    const userId = (req as any).user.userId as string
    const page   = await Page.findById(id)
    if (!page) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    page.favoritedBy = page.favoritedBy.filter((u) => u.toString() !== userId)
    await page.save()
    res.status(204).send()
  } catch (err) { next(err) }
}
