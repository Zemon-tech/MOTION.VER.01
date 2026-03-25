import type { Request, Response, NextFunction } from 'express'
import { User } from '../db/models/User'
import RedisService from '../services/redis.service'
import { Types } from 'mongoose'

export async function health(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ status: 'ok', message: 'User service is working' })
  } catch (err) {
    next(err)
  }
}

export async function clearSharedLinks(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } })
    const links: Array<{ pageId: any; token?: string }> = Array.isArray((user as any).sharedLinks) ? (user as any).sharedLinks.map((l: any) => ({ pageId: l.pageId, token: l.token })) : []
    const blocked = Array.isArray((user as any).sharedBlocked) ? (user as any).sharedBlocked : []
    const now = new Date()
    for (const l of links) {
      const exists = blocked.some((b: any) => String(b.pageId) === String(l.pageId))
      if (!exists) blocked.push({ pageId: new Types.ObjectId(l.pageId), token: l.token, blockedAt: now })
    }
    ;(user as any).sharedBlocked = blocked
    ;(user as any).sharedLinks = []
    await user.save()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

export async function upsertRecentVisited(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const { slug } = req.body as { slug?: string }
    if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    if (!slug) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'slug is required' } })
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } })
    const now = new Date()
    const list = Array.isArray((user as any).recentVisited) ? (user as any).recentVisited : []
    const filtered = list.filter((e: any) => e && e.slug !== slug)
    const nextList = [{ slug, ts: now }, ...filtered].slice(0, 30)
    ;(user as any).recentVisited = nextList
    await user.save()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

export async function getRecentVisited(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    const user = await User.findById(userId).lean()
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } })
    const recentVisited = (user as any).recentVisited || []
    res.json({ recentVisited })
  } catch (err) {
    next(err)
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    console.log('User ID from token:', userId)
    
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User ID not found in token' } })
    }
    
    // Try to get user from cache first (temporarily disabled for debugging)
    let user = null // await RedisService.getUser(userId)
    console.log('User from cache:', user ? 'found' : 'not found')
    
    if (!user) {
      // Cache miss - fetch from database
      console.log('Fetching user from database...')
      const dbUser = await User.findById(userId).lean()
      if (!dbUser) {
        console.log('User not found in database')
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } })
      }
      
      user = {
        id: dbUser._id.toString(),
        email: dbUser.email,
        name: dbUser.name,
        avatarUrl: dbUser.avatarUrl,
      }
      
      // Cache the user data (temporarily disabled for debugging)
      // await RedisService.cacheUser(userId, user)
      console.log('User fetched from database successfully')
    }
    
    console.log('Returning user:', user)
    res.json({ user })
  } catch (err) {
    console.error('Error in me controller:', err)
    next(err)
  }
}

export async function getLastPage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const lastPage = await RedisService.getLastPage(userId)
    
    if (!lastPage) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No last page found' } })
    }
    
    res.json({ lastPage })
  } catch (err) {
    next(err)
  }
}


