import express, { type Application } from 'express'
import path from 'path'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { corsConfig } from './config/cors'
import { errorHandler } from './middleware/errorHandler'
import routes from './routes'

export function createApp(): Application {
  const app = express()

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }))
  app.use(cors(corsConfig))
  const QUIET = process.env.QUIET_META_LOGS === '1'
  app.use(morgan('dev', {
    skip: (req, res) => {
      // Optionally hide very noisy metadata/image proxy requests and 304s
      if (res.statusCode === 304) return true
      if (!QUIET) return false
      const p = req.path || ''
      return p.startsWith('/api/links/metadata') || p.startsWith('/api/links/image')
    },
  }))
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: false }))
  app.use(cookieParser())

  // static serving for local uploads (dev)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

  app.use('/api', routes)

  app.use(errorHandler)

  return app
}


