import type { Request, Response, NextFunction } from 'express'
import { Page } from '../db/models/Page'
import { makeSlug, extractIdFromSlug } from '../utils/slug'
import RedisService from '../services/redis.service'
import crypto from 'crypto'
import { User } from '../db/models/User'
import { canRead, canEdit, isTokenValid } from '../services/perm.service'
import { emitSubpageMetaToAncestors, emitSubpageDeletedToAncestors } from '../services/socketHub'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function searchPages(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const query = (req.query.q as string) || ''
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    
    // Search pages owner by user or shared with user
    const pages = await Page.find({
      $and: [
        {
          $or: [
            { ownerId: userId },
            { 'collaborators.userId': userId },
            { sharedWith: userId },
          ]
        },
        {
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { 'content.content.text': { $regex: query, $options: 'i' } } // Very basic Tiptap content search
          ]
        }
      ]
    })
    .select('_id title slug icon updatedAt')
    .limit(10)
    .lean()

    res.json({ pages })
  } catch (err) {
    next(err)
  }
}

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

export async function updateLock(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id
    const userId = (req as any).user?.userId
    const { locked, password } = req.body as { locked: boolean; password?: string }
    const page = await Page.findById(id)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (String(page.ownerId) !== String(userId)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    ;(page as any).locked = !!locked
    if (locked) {
      if (!password && !(page as any).lockPasswordHash) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Password required to lock' } })
      if (password) {
        const salt = await bcrypt.genSalt(10)
        ;(page as any).lockPasswordHash = await bcrypt.hash(password, salt)
      }
    } else {
      ;(page as any).lockPasswordHash = undefined as any
    }
    await page.save()
    res.json({ ok: true, page: { _id: String(page._id), locked: (page as any).locked } })
  } catch (err) {
    next(err)
  }
}

export async function verifyLock(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id
    const { password } = req.body as { password: string }
    const page = await Page.findById(id).select('_id locked lockPasswordHash')
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (!(page as any).locked) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Page not locked' } })
    const ok = (page as any).lockPasswordHash ? await bcrypt.compare(password, (page as any).lockPasswordHash) : false
    if (!ok) return res.status(401).json({ error: { code: 'INVALID_PASSWORD', message: 'Invalid password' } })
    const token = jwt.sign({ sub: String(page._id), typ: 'unlock' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' })
    res.json({ ok: true, unlock: token })
  } catch (err) {
    next(err)
  }
}

export async function getPagesMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const idsParam = (req.query.ids as string | undefined) || ''
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    if (!ids.length) return res.json({ pages: [] })
    const docs = await Page.find({ _id: { $in: ids } }).select('_id title slug icon').lean()
    const pages = docs.map((d: any) => ({ _id: String(d._id), title: d.title, slug: d.slug || makeSlug(d.title, String(d._id)), icon: d.icon || null }))
    res.json({ pages })
  } catch (err) {
    next(err)
  }
}

export async function getAncestors(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id
    const userId = (req as any).user?.userId || null
    const page = await Page.findById(id).lean()
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    const readable = canRead(userId, page, undefined)
    if (!readable) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const ancestorIds: string[] = Array.isArray((page as any).ancestors)
      ? (page as any).ancestors.map((a: any) => String(a))
      : []
    if (!ancestorIds.length) return res.json({ ancestors: [] })
    const docs = await Page.find({ _id: { $in: ancestorIds } })
      .select('_id title slug icon parentId')
      .lean()
    // preserve original order as stored in page.ancestors
    const byId = new Map<string, any>()
    for (const d of docs) byId.set(String((d as any)._id), d)
    const ancestors = ancestorIds.map((aid) => byId.get(aid)).filter(Boolean)
    res.json({ ancestors })
  } catch (err) {
    next(err)
  }
}

export async function listSharedByMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    const pages = await Page.find({ ownerId: userId }).select('_id title slug isPublic linkEditEnabled collaborators updatedAt').lean()
    const shared = pages.filter((p: any) => {
      const collabEditors = Array.isArray(p.collaborators) && p.collaborators.some((c: any) => c.role === 'editor')
      const linkEditors = !!p.isPublic && !!p.linkEditEnabled
      return collabEditors || linkEditors
    })
    res.json({ pages: shared })
  } catch (err) {
    next(err)
  }
}

export async function listCollaborators(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const id = req.params.id
    const page = await Page.findById(id).lean()
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (String(page.ownerId) !== String(userId)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const owner = await User.findById(page.ownerId).select('_id email name avatarUrl').lean()
    // Merge legacy sharedWith (editor) and new collaborators with roles
    const collabMap: Record<string, { _id: string; email: string; name?: string; role: 'viewer' | 'editor' }> = {}
    const collabUsers = Array.isArray(page.collaborators) ? page.collaborators : []
    for (const c of collabUsers) {
      const u = await User.findById(c.userId).select('_id email name').lean()
      if (u) collabMap[String(u._id)] = { _id: String(u._id), email: u.email as string, name: u.name as any, role: c.role }
    }
    // Legacy sharedWith are editors
    const legacy = Array.isArray(page.sharedWith) ? page.sharedWith : []
    for (const uid of legacy) {
      const idStr = String(uid)
      if (!collabMap[idStr]) {
        const u = await User.findById(idStr).select('_id email name').lean()
        if (u) collabMap[idStr] = { _id: String(u._id), email: u.email as string, name: u.name as any, role: 'editor' }
      }
    }
    const collaborators = Object.values(collabMap)
    res.json({ owner, collaborators })
  } catch (err) {
    next(err)
  }
}

export async function inviteCollaborator(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const id = req.params.id
    const { email } = req.body as { email: string }
    if (!email) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'email required' } })
    const page = await Page.findById(id)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (String(page.ownerId) !== String(userId)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } })
    const uid = user._id.toString()
    const existingLegacy = Array.isArray(page.sharedWith) && (page.sharedWith as any[]).some((u: any) => String(u) === uid)
    const existingCollab = Array.isArray((page as any).collaborators) && (page as any).collaborators.some((c: any) => String(c.userId) === uid)
    if (!existingLegacy && !existingCollab) {
      ;(page as any).collaborators = Array.isArray((page as any).collaborators) ? (page as any).collaborators : []
      ;(page as any).collaborators.push({ userId: user._id, role: 'editor' })
      await page.save()
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

export async function removeCollaborator(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const id = req.params.id
    const targetUserId = req.params.userId
    const page = await Page.findById(id)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (String(page.ownerId) !== String(userId)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    page.sharedWith = (page.sharedWith || []).filter((u: any) => String(u) !== String(targetUserId)) as any
    ;(page as any).collaborators = Array.isArray((page as any).collaborators) ? (page as any).collaborators.filter((c: any) => String(c.userId) !== String(targetUserId)) : []
    await page.save()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

export async function updateCollaboratorRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const id = req.params.id
    const targetUserId = req.params.userId
    const { role } = req.body as { role: 'viewer' | 'editor' }
    if (!['viewer', 'editor'].includes(role)) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid role' } })
    const page = await Page.findById(id)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (String(page.ownerId) !== String(userId)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    ;(page as any).collaborators = Array.isArray((page as any).collaborators) ? (page as any).collaborators : []
    const idx = (page as any).collaborators.findIndex((c: any) => String(c.userId) === String(targetUserId))
    if (idx === -1) {
      (page as any).collaborators.push({ userId: targetUserId as any, role })
    } else {
      (page as any).collaborators[idx].role = role
    }
    await page.save()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}


export async function listSharedPages(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    const user = await User.findById(userId).select('sharedLinks sharedBlocked').lean()

    // Start with claimed link shares (these include token)
    const linkShares: any[] = Array.isArray((user as any)?.sharedLinks) ? (user as any)?.sharedLinks : []

    // Find pages where the user is an invited collaborator (new model) or in legacy sharedWith
    const collabPages = await Page.find({
      $or: [
        { 'collaborators.userId': userId },
        { sharedWith: userId },
      ],
    })
      .select('_id title slug ownerId updatedAt createdAt')
      .lean()

    // Load owners for name display
    const ownerIds = Array.from(new Set(collabPages.map((p: any) => String(p.ownerId))))
    const owners = ownerIds.length
      ? await User.find({ _id: { $in: ownerIds } }).select('_id name email').lean()
      : []
    const ownerMap = new Map<string, { name?: string; email?: string }>()
    for (const o of owners) ownerMap.set(String(o._id), { name: o.name as any, email: o.email as any })

    // Convert collaborator pages into the same shape as link shares (no token)
    const collabShares = collabPages
      .filter((p: any) => String(p.ownerId) !== String(userId))
      .map((p: any) => {
        const owner = ownerMap.get(String(p.ownerId))
        return {
          pageId: p._id,
          slug: p.slug || makeSlug(p.title, String(p._id)),
          token: null,
          title: p.title,
          ownerId: p.ownerId,
          ownerName: owner?.name || owner?.email || 'Owner',
          addedAt: (p.updatedAt || p.createdAt || new Date()).toISOString(),
        }
      })

    // Merge with claimed link shares and remove duplicates by (pageId, token)
    const combined = [...linkShares, ...collabShares]
    const seen = new Set<string>()
    let deduped = combined.filter((s: any) => {
      const key = `${String(s.pageId)}|${s.token || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Enrich with icons from pages
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
  } catch (err) {
    next(err)
  }
}

export async function claimLink(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const pageId = req.params.id
    const { token } = req.body as { token?: string | null }
    if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    if (!pageId || !token) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'pageId and token required' } })
    const page = await Page.findById(pageId)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    // Ensure the user can edit via this token
    const editable = canEdit(userId, page.toObject(), token)
    if (!editable) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } })
    // If user previously cleared/blocked this page, do not allow claim
    const blocked = Array.isArray((user as any).sharedBlocked) && (user as any).sharedBlocked.some((b: any) => String(b.pageId) === String(page._id))
    if (blocked) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Shared page cleared by user' } })
    const slug = page.slug || makeSlug(page.title, page._id.toString())
    const arr: any[] = Array.isArray((user as any).sharedLinks) ? (user as any).sharedLinks : []
    const exists = arr.some((e: any) => String(e.pageId) === String(page._id) && e.token === token)
    if (!exists) {
      // fetch owner to capture name
      const owner = await User.findById(page.ownerId).select('_id name email').lean()
      const ownerName = owner?.name || owner?.email || 'Owner'
      arr.push({ pageId: page._id, slug, token, title: page.title, ownerId: page.ownerId, ownerName, addedAt: new Date() })
      ;(user as any).sharedLinks = arr
      await user.save()
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

export async function createPage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId
    const { title, content } = req.body as { title?: string; content?: any }
    const pageTitle = title || 'Untitled'
    
    console.log('Creating page with title:', pageTitle, 'for user:', userId)
    
    // Generate a temporary ID for slug creation
    const tempId = new Date().getTime().toString()
    const slug = makeSlug(pageTitle, tempId)
    
    console.log('Generated slug:', slug)
    
    // Create page with the generated slug
    const page = await Page.create({ 
      ownerId: userId, 
      title: pageTitle, 
      content: content || EMPTY_DOC,
      slug: slug
    })
    
    console.log('Page created successfully with slug:', page.slug)
    console.log('Page ID:', page._id)
    
    res.status(201).json({ page, slug: page.slug })
  } catch (err) {
    console.error('Error creating page:', err)
    if (err instanceof Error) {
      console.error('Error details:', err.message)
      console.error('Error stack:', err.stack)
    }
    next(err)
  }
}

export async function listMyPages(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    console.log('User ID for pages:', userId)
    
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User ID not found in token' } })
    }
    
    // Try to get pages from cache first (temporarily disabled for debugging)
    let pages: any[] | null = null // await RedisService.getUserPages(userId)
    console.log('Pages from cache:', pages ? `${(pages as any[]).length} found` : 'not found')
    
    if (!pages) {
      // Cache miss - fetch from database
      console.log('Fetching pages from database...')
      const dbPages = await Page.find({ ownerId: userId }).sort({ createdAt: -1 }).lean()
      console.log(`Found ${dbPages.length} pages in database`)
      
      // Ensure all pages have slugs
      pages = dbPages.map(page => ({
        ...page,
        slug: page.slug || makeSlug(page.title, page._id.toString())
      }))
      
      // Cache the pages list (temporarily disabled for debugging)
      // await RedisService.cacheUserPages(userId, pages)
      console.log('Pages fetched from database successfully')
    }
    
    console.log('Returning pages:', pages.length)
    res.json({ pages })
  } catch (err) {
    console.error('Error in listMyPages controller:', err)
    next(err)
  }
}

export async function listPublicPages(_req: Request, res: Response, next: NextFunction) {
  try {
    const pages = await Page.find({ isPublic: true }).sort({ createdAt: -1 }).lean()
    res.json({ pages })
  } catch (err) {
    next(err)
  }
}

export async function getPage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id
    const userId = (req as any).user?.userId
    
    // Try to get page content from cache first
    let pageContent = id ? await RedisService.getPageContent(id) : null
    let page
    
    if (!pageContent) {
      // Cache miss - fetch from database
      page = await Page.findById(id)
      if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })

      // Support token via query (?t=token) for public links that use the id route
      const token = typeof req.query.t === 'string' ? String(req.query.t) : undefined
      const readable = canRead(userId || null, page.toObject(), token)
      // If not readable and page is not locked, deny. If locked, allow proceeding to lock gate.
      if (!readable && !(page as any).locked) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })

      // Enforce lock when page is locked, except owner bypass
      if ((page as any).locked) {
        const isOwner = userId && page.ownerId.toString() === String(userId)
        if (isOwner) {
          // owner bypasses lock
        } else {
          const unlock = (req.headers['x-page-unlock'] as string | undefined) || undefined
          if (!unlock) {
            return res.status(401).json({ error: { code: 'LOCKED', message: 'Page is locked', pageId: String(page._id) } })
          }
          try {
            const payload = jwt.verify(unlock, process.env.JWT_SECRET || 'secret') as any
            if (!payload || payload.sub !== String(page._id)) {
              return res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String(page._id) } })
            }
          } catch {
            return res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String(page._id) } })
          }
        }
      }

      // Cache the page content
      if (id) await RedisService.cachePageContent(id, page)
      pageContent = page
    } else {
      page = pageContent
      // When serving from cache, still enforce readability and lock, same as cache-miss path
      const token = typeof req.query.t === 'string' ? String(req.query.t) : undefined
      const readable = canRead(userId || null, (page as any), token)
      if (!readable && !(page as any).locked) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
      if ((page as any).locked) {
        const isOwner = userId && String((page as any).ownerId) === String(userId)
        if (!isOwner) {
          const unlock = (req.headers['x-page-unlock'] as string | undefined) || undefined
          if (!unlock) {
            return res.status(401).json({ error: { code: 'LOCKED', message: 'Page is locked', pageId: String((page as any)._id) } })
          }
          try {
            const payload = jwt.verify(unlock, process.env.JWT_SECRET || 'secret') as any
            if (!payload || payload.sub !== String((page as any)._id)) {
              return res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String((page as any)._id) } })
            }
          } catch {
            return res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String((page as any)._id) } })
          }
        }
      }
    }
    
    // Cache this as the user's last accessed page
    if (userId) {
      await RedisService.cacheLastPage(userId, {
        id: page._id.toString(),
        title: page.title,
        slug: makeSlug(page.title, page._id.toString()),
        updatedAt: page.updatedAt,
      })
    }
    
    const slug = makeSlug(page.title, page._id.toString())
    res.json({ page, slug })
  } catch (err) {
    next(err)
  }
}

export async function updatePage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id
    const userId = (req as any).user.userId
    const page = await Page.findById(id)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    const editable = canEdit(userId, page.toObject(), undefined)
    if (!editable) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const { title, content, coverImageUrl, coverPosition, icon } = req.body as any
    const prevTitle = page.title
    const prevIcon = (page as any).icon
    if (title !== undefined) {
      page.title = title
      // Update slug when title changes
      page.slug = makeSlug(title, page._id.toString())
    }
    if (content !== undefined) page.content = content
    if (coverImageUrl !== undefined) page.coverImageUrl = coverImageUrl
    if (coverPosition !== undefined) page.coverPosition = coverPosition
    if (icon !== undefined) page.icon = icon
    await page.save()
    
    // Invalidate page cache since content changed
    if (id) await RedisService.invalidatePageCache(id)
    try {
      const changed = (title !== undefined && title !== prevTitle) || (icon !== undefined && icon !== prevIcon)
      if (changed) {
        let targets = Array.isArray((page as any).ancestors) ? (page as any).ancestors.map((a: any) => String(a)) : []
        if (!targets.length && (page as any).parentId) targets = [String((page as any).parentId)]
        if (targets.length) emitSubpageMetaToAncestors(targets, { pageId: String(page._id), ...(title !== undefined ? { title } : {}), ...(icon !== undefined ? { icon } : {}) })
      }
    } catch {}
    
    res.json({ page, slug: page.slug })
  } catch (err) {
    next(err)
  }
}

export async function createSubpage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId
    const parentId = req.params.id
    const { title } = req.body as { title?: string }
    const parent = await Page.findById(parentId)
    if (!parent) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Parent page not found' } })
    const editable = canEdit(userId, parent.toObject(), undefined)
    if (!editable) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const pageTitle = title || 'Untitled'
    const tempId = new Date().getTime().toString()
    const slug = makeSlug(pageTitle, tempId)
    const ancestors = Array.isArray((parent as any).ancestors) ? [...(parent as any).ancestors, parent._id] : [parent._id]
    const sub = await Page.create({ ownerId: parent.ownerId, title: pageTitle, content: EMPTY_DOC, slug, parentId: parent._id, ancestors })
    res.status(201).json({ page: sub, slug: sub.slug })
  } catch (err) {
    next(err)
  }
}

export async function updatePrivacy(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id
    const userId = (req as any).user.userId
    const page = await Page.findById(id)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (page.ownerId.toString() !== userId) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const { isPublic, linkEditEnabled, linkExpiresAt, rotateToken } = req.body as { isPublic: boolean; linkEditEnabled?: boolean; linkExpiresAt?: string | null; rotateToken?: boolean }
    page.isPublic = isPublic
    if (typeof linkEditEnabled === 'boolean') page.linkEditEnabled = linkEditEnabled
    if (linkExpiresAt !== undefined) (page as any).linkExpiresAt = linkExpiresAt ? new Date(linkExpiresAt) : null
    if (isPublic) {
      // generate token if missing or explicitly rotating
      if (!page.shareToken || rotateToken) {
        page.shareToken = crypto.randomBytes(12).toString('hex')
      }
    } else {
      // when making private, clear token
      page.shareToken = undefined as any
      // optional: also disable link edit when no longer public
      // page.linkEditEnabled = false
    }
    await page.save()
    const slug = makeSlug(page.title, page._id.toString())
    res.json({ page: { ...page.toObject(), shareToken: page.shareToken }, slug })
  } catch (err) {
    next(err)
  }
}

export async function sharePage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id
    const userId = (req as any).user.userId
    const page = await Page.findById(id)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (page.ownerId.toString() !== userId) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    const { userId: targetUserId, action } = req.body as { userId: string; action: 'add' | 'remove' }
    const idStr = targetUserId
    if (action === 'add') {
      if (!page.sharedWith.some((id) => id.toString() === idStr)) page.sharedWith.push(idStr as any)
    } else {
      page.sharedWith = page.sharedWith.filter((id) => id.toString() !== idStr)
    }
    await page.save()
    res.json({ page })
  } catch (err) {
    next(err)
  }
}

export async function deletePage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id
    const userId = (req as any).user.userId
    const page = await Page.findById(id)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (page.ownerId.toString() !== userId) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    // Emit deletion so parents can remove the block immediately
    try {
      const ancestors = Array.isArray((page as any).ancestors) ? (page as any).ancestors.map((a: any) => String(a)) : []
      if (ancestors.length) emitSubpageDeletedToAncestors(ancestors, { pageId: String(page._id) })
    } catch {}
    // Cascade delete descendants
    await Page.deleteMany({ $or: [{ _id: id }, { ancestors: id }] })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function getPageBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = String(req.params.slug || '')
    const userId = (req as any).user?.userId
    // Support token either appended to slug as '<slug>.<token>' or via query ?t=token
    let token: string | null = null
    let slug = raw
    const dotIdx = raw.lastIndexOf('.')
    if (dotIdx > 0 && dotIdx < raw.length - 1) {
      slug = raw.slice(0, dotIdx)
      token = raw.slice(dotIdx + 1)
    }
    if (!token && typeof req.query.t === 'string') token = String(req.query.t)
    
    // Try to find page by slug first
    let page = await Page.findOne({ slug }).lean()
    
    if (!page) {
      // Fallback to old method for backward compatibility
      const id = slug ? extractIdFromSlug(slug) : null
      if (id) {
        page = await Page.findById(id).lean()
      }
    }
    
    if (!page) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    }
    
    const owner = userId && page.ownerId.toString() === userId
    let readable = canRead(userId || null, page, token || undefined)
    let editable = canEdit(userId || null, page, token || undefined)

    // Inherit share token from any public ancestor (Notion-like behavior)
    if (!readable && token) {
      try {
        let ancestorIds: string[] = Array.isArray((page as any).ancestors)
          ? (page as any).ancestors.map((a: any) => String(a))
          : []
        // Fallback for older docs without ancestors: use parentId as a single ancestor
        if (!ancestorIds.length && (page as any).parentId) {
          ancestorIds = [String((page as any).parentId)]
        }
        if (ancestorIds.length) {
          const ancestors = await Page.find({ _id: { $in: ancestorIds } })
            .select('_id isPublic shareToken linkExpiresAt linkEditEnabled ownerId')
            .lean()
          const ancestorWithValidToken = ancestors.find((ap: any) => !!ap?.isPublic && isTokenValid(ap, token))
          if (ancestorWithValidToken) {
            readable = true
            // Editing via link is still controlled by the page itself; do not automatically grant edit here
            // unless you want to mirror ancestor.linkEditEnabled. We keep current editable check.
          }
        }
      } catch {}
    }
    // If user has blocked this shared page, deny access only if they are not owner or collaborator
    if (userId) {
      try {
        const u = await User.findById(userId).select('sharedBlocked').lean()
        const blocked = Array.isArray((u as any)?.sharedBlocked) && (u as any).sharedBlocked.some((b: any) => String(b.pageId) === String(page._id))
        const isCollab = Array.isArray((page as any)?.collaborators) && (page as any).collaborators.some((c: any) => String(c.userId) === String(userId))
        if (blocked && !owner && !isCollab) { readable = false; editable = false }
      } catch {}
    }
    
    if (!readable && !(page as any).locked) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    }

    // Lock enforcement with owner bypass
    if ((page as any).locked) {
      const isOwner = userId && page.ownerId.toString() === String(userId)
      if (!isOwner) {
        const unlock = (req.headers['x-page-unlock'] as string | undefined) || undefined
        if (!unlock) {
          return res.status(401).json({ error: { code: 'LOCKED', message: 'Page is locked', pageId: String(page._id) } })
        }
        try {
          const payload = jwt.verify(unlock, process.env.JWT_SECRET || 'secret') as any
          if (!payload) {
            return res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String(page._id) } })
          }
          // Accept unlock token for this page or any ancestor to allow seamless navigation within a shared tree
          let ancestorIds: string[] = Array.isArray((page as any).ancestors)
            ? (page as any).ancestors.map((a: any) => String(a))
            : []
          if (!ancestorIds.length && (page as any).parentId) {
            ancestorIds = [String((page as any).parentId)]
          }
          const allowedIds = new Set<string>([String(page._id), ...ancestorIds])
          if (!allowedIds.has(String(payload.sub))) {
            return res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String(page._id) } })
          }
        } catch {
          return res.status(401).json({ error: { code: 'LOCKED', message: 'Invalid unlock token', pageId: String(page._id) } })
        }
      }
    }
    
    // Ensure page has a slug and only expose shareToken to owner
    const pageWithSlug = {
      ...page,
      slug: page.slug || makeSlug(page.title, page._id.toString()),
      ...(owner ? {} : { shareToken: undefined })
    }
    res.json({ page: pageWithSlug, canView: true, canEdit: !!editable, isOwner: !!owner })
  } catch (err) {
    next(err)
  }
}

export async function starPage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id
    const userId = (req as any).user.userId
    const page = await Page.findById(id)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    if (!page.favoritedBy.some((u) => u.toString() === userId)) page.favoritedBy.push(userId as any)
    await page.save()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function unstarPage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id
    const userId = (req as any).user.userId
    const page = await Page.findById(id)
    if (!page) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found' } })
    page.favoritedBy = page.favoritedBy.filter((u) => u.toString() !== userId)
    await page.save()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}


