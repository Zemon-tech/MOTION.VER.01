import express, { type Application } from 'express'
import path from 'path'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { corsConfig } from './config/cors'
import { errorHandler } from './middleware/errorHandler'
import { requestId, notFoundHandler } from './middleware/requestId'
import { logger } from './utils/logger'
import routes from './routes'

export function createApp(): Application {
  const app = express()

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

  // Log CORS rejections — the cors package silently drops disallowed origins
  // unless we add an error handler. We wrap it to capture the origin.
  app.use((req, res, next) => {
    const origin = req.headers.origin
    cors(corsConfig)(req, res, (err) => {
      if (err) {
        logger.warn('http.cors', 'CORS request rejected', {
          origin:  origin ?? 'none',
          method:  req.method,
          path:    req.path,
          fix:     `Add "${origin}" to CORS_ORIGIN in .env or update corsConfig`,
        })
      }
      next(err)
    })
  })

  const QUIET = process.env.QUIET_META_LOGS === '1'
  app.use(morgan('dev', {
    skip: (req, res) => {
      if (res.statusCode === 304) return true
      if (!QUIET) return false
      const p = req.path || ''
      return p.startsWith('/api/links/metadata') || p.startsWith('/api/links/image')
    },
  }))

  // Body parsing — errors (too large, malformed JSON) are caught by errorHandler
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: false }))
  app.use(cookieParser())

  // requestId must come before routes so every log line in a request carries it
  app.use(requestId)

  // Static uploads (dev only)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

  app.use('/api', routes)

  // 404 handler — must come after all routes
  app.use(notFoundHandler)

  // Central error handler — must be last
  app.use(errorHandler)

  return app
}
