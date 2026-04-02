import type { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../db/models/User'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/token.service'
import RedisService from '../services/redis.service'
import { logger, redactEmail, requestContext } from '../utils/logger'

const REFRESH_COOKIE = 'refreshToken'
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const isLocal = /^(http:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(corsOrigin)

const cookieOptions = isLocal
  ? ({ httpOnly: true, secure: false, sameSite: 'lax'  as const, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 })
  : ({ httpOnly: true, secure: true,  sameSite: 'none' as const, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 })

// ─── Signup ───────────────────────────────────────────────────────────────────

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, name } = req.body as { email: string; password: string; name?: string }

    const existing = await User.findOne({ email }).lean()
    if (existing) {
      logger.warn('auth.signup', 'Signup failed — email already in use', {
        email: redactEmail(email),
      })
      return next(Object.assign(new Error('An account with this email already exists.'), { status: 409, code: 'EMAIL_TAKEN' }))
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ email, passwordHash, name })
    const userId = user._id.toString()

    const payload = { userId, email: user.email }
    const accessToken  = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    await RedisService.cacheUser(userId, {
      id: userId, email: user.email, name: user.name, avatarUrl: user.avatarUrl,
    })

    // Inject userId into log context for this request
    const ctx = requestContext.getStore()
    if (ctx) ctx.userId = userId

    logger.info('auth.signup', 'User signed up successfully', {
      userId,
      email: redactEmail(email),
    })

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions)
    res.status(201).json({ user: { id: userId, email: user.email, name: user.name }, accessToken })
  } catch (err) {
    next(err)
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string }

    const user = await User.findOne({ email })
    if (!user) {
      logger.warn('auth.login', 'Login failed — user not found', {
        email: redactEmail(email),
        ip: req.ip,
      })
      return next(Object.assign(new Error('No account found with this email address.'), { status: 401, code: 'USER_NOT_FOUND' }))
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      logger.warn('auth.login', 'Login failed — wrong password', {
        userId: user._id.toString(),
        email: redactEmail(email),
        ip: req.ip,
      })
      return next(Object.assign(new Error('Incorrect password. Please try again.'), { status: 401, code: 'WRONG_PASSWORD' }))
    }

    const userId = user._id.toString()
    const payload = { userId, email: user.email }
    const accessToken  = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    await RedisService.cacheUser(userId, {
      id: userId, email: user.email, name: user.name, avatarUrl: user.avatarUrl,
    })

    const ctx = requestContext.getStore()
    if (ctx) ctx.userId = userId

    logger.info('auth.login', 'User logged in', {
      userId,
      email: redactEmail(email),
      lastLoginAt: (user as any).lastLoginAt?.toISOString(),
    })

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions)
    res.status(200).json({ user: { id: userId, email: user.email, name: user.name }, accessToken })
  } catch (err) {
    next(err)
  }
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined

    if (!token) {
      logger.warn('auth.refresh', 'Refresh failed — no cookie present', { ip: req.ip })
      return next(Object.assign(new Error('No refresh token.'), { status: 401, code: 'TOKEN_MISSING' }))
    }

    let payload: any
    try {
      payload = verifyRefreshToken(token)
    } catch (err) {
      const isExpired = err instanceof jwt.TokenExpiredError

      // Decode without verifying to get userId for the log (untrusted)
      let uid: string | undefined
      let expiredAt: string | undefined
      try {
        const raw = jwt.decode(token) as any
        uid = raw?.userId
        expiredAt = raw?.exp ? new Date(raw.exp * 1000).toISOString() : undefined
      } catch {}

      if (isExpired) {
        logger.warn('auth.refresh', 'Refresh token expired', {
          userId: uid,
          expiredAt,
          ip: req.ip,
        })
        return next(Object.assign(new Error('Session expired.'), { status: 401, code: 'TOKEN_EXPIRED' }))
      }

      logger.warn('auth.refresh', 'Refresh token invalid — possible tampering', {
        ip: req.ip,
        reason: (err as Error).message,
      })
      return next(Object.assign(new Error('Invalid token.'), { status: 401, code: 'TOKEN_INVALID' }))
    }

    const accessToken  = signAccessToken({ userId: payload.userId, email: payload.email })
    const newRefresh   = signRefreshToken({ userId: payload.userId, email: payload.email })

    const ctx = requestContext.getStore()
    if (ctx) ctx.userId = payload.userId

    logger.info('auth.refresh', 'Token refreshed', { userId: payload.userId })

    res.cookie(REFRESH_COOKIE, newRefresh, cookieOptions)
    res.json({ accessToken })
  } catch (err) {
    next(err)
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const userId = (req as any).user?.userId
  logger.info('auth.logout', 'User logged out', { userId })
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: 0 })
  res.status(204).send()
}
