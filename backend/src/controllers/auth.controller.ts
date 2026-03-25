import type { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { User } from '../db/models/User'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/token.service'
import RedisService from '../services/redis.service'

const REFRESH_COOKIE = 'refreshToken'
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const isLocal = /^(http:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(corsOrigin)

const cookieOptions = isLocal
  ? ({
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
  : ({
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = req.body as { email: string; password: string; name?: string }
    const existing = await User.findOne({ email }).lean()
    if (existing) {
      const err = new Error('Email already in use') as any
      err.status = 409
      err.code = 'CONFLICT'
      return next(err)
    }
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ email, passwordHash, name })
    const payload = { userId: user._id.toString(), email: user.email }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)
    
    // Cache user data in Redis
    await RedisService.cacheUser(user._id.toString(), {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    })
    
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions)
    res.status(201).json({ user: { id: payload.userId, email: user.email, name: user.name }, accessToken })
  } catch (err) {
    next(err)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email: string; password: string }
    const user = await User.findOne({ email })
    if (!user) {
      const e = new Error('Invalid credentials') as any
      e.status = 401
      e.code = 'UNAUTHORIZED'
      return next(e)
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      const e = new Error('Invalid credentials') as any
      e.status = 401
      e.code = 'UNAUTHORIZED'
      return next(e)
    }
    const payload = { userId: user._id.toString(), email: user.email }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)
    
    // Cache user data in Redis
    await RedisService.cacheUser(user._id.toString(), {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    })
    
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions)
    res.status(200).json({ user: { id: payload.userId, email: user.email, name: user.name }, accessToken })
  } catch (err) {
    next(err)
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE]
    if (!token) {
      const e = new Error('No refresh token') as any
      e.status = 401
      e.code = 'UNAUTHORIZED'
      return next(e)
    }
    const payload = verifyRefreshToken(token)
    const accessToken = signAccessToken({ userId: payload.userId, email: payload.email })
    const newRefresh = signRefreshToken({ userId: payload.userId, email: payload.email })
    res.cookie(REFRESH_COOKIE, newRefresh, cookieOptions)
    res.json({ accessToken })
  } catch (err) {
    next(err)
  }
}

export async function logout(_req: Request, res: Response, _next: NextFunction) {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: 0 })
  res.status(204).send()
}


