/**
 * Server entry point.
 *
 * Order of operations:
 *   1. Load .env
 *   2. Validate all required env vars — exit immediately if any missing/invalid
 *   3. Register process-level error handlers (uncaughtException, unhandledRejection)
 *   4. Register signal handlers (SIGTERM, SIGINT) for graceful shutdown
 *   5. Create Express app
 *   6. Create HTTP server
 *   7. Attach Socket.IO
 *   8. Start listening
 *   9. Connect to MongoDB (non-blocking — server accepts requests while connecting)
 */

// ── Step 1: env must be loaded before anything reads process.env ──────────────
import dotenv from 'dotenv'
dotenv.config()

// ── Step 2: validate env — exits with FATAL messages if anything is wrong ─────
import { validateEnv, env } from './config/env'
validateEnv()

// ── Everything else ───────────────────────────────────────────────────────────
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import jwt from 'jsonwebtoken'
import { Page } from './db/models/Page'
import { createApp } from './app'
import { connectMongo, disconnectMongo } from './db/connection'
import { canRead, canEdit } from './services/perm.service'
import { setIO, emitSubpageMetaToAncestors } from './services/socketHub'
import { logger, requestContext } from './utils/logger'

// ─── Process-level error handlers ────────────────────────────────────────────
// These must be registered before any async work starts.

process.on('uncaughtException', (err: Error) => {
  logger.error('process.uncaughtException', `Uncaught exception — ${err.message}`, {
    stack: err.stack,
    fix:   'This is a programmer error. Find the throw site in the stack trace and add proper error handling.',
  })
  // Give the logger time to flush, then exit — the process is in an unknown state
  setTimeout(() => process.exit(1), 500)
})

process.on('unhandledRejection', (reason: unknown) => {
  const msg   = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack   : undefined
  logger.error('process.unhandledRejection', `Unhandled promise rejection — ${msg}`, {
    stack,
    fix: 'Add .catch() or try/catch to the promise that rejected. Find it in the stack trace above.',
  })
  setTimeout(() => process.exit(1), 500)
})

// ─── Socket helpers ───────────────────────────────────────────────────────────

function socketUserId(socket: any): string | undefined {
  return socket.user?.userId as string | undefined
}

function socketIp(socket: any): string {
  return (
    (socket.handshake.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    socket.handshake.address ??
    'unknown'
  )
}

function socketCtx<T>(socketId: string, userId: string | undefined, fn: () => Promise<T>): Promise<T> {
  const requestId = `ws_${socketId.slice(0, 8)}`
  return requestContext.run({ requestId, userId }, fn)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const app    = createApp()
  const server = createServer(app)

  const io = new SocketIOServer(server, {
    cors: {
      origin:         env.CORS_ORIGIN,
      credentials:    true,
      methods:        ['GET', 'POST'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    },
    transports: ['websocket', 'polling'],
  })
  setIO(io)

  // ── Graceful shutdown ──────────────────────────────────────────────────────

  let isShuttingDown = false

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return
    isShuttingDown = true

    logger.info('server.shutdown', `${signal} received — starting graceful shutdown`)

    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error('server.shutdown', 'Error closing HTTP server', { error: err.message })
      } else {
        logger.info('server.shutdown', 'HTTP server closed — no longer accepting connections')
      }

      // Close Socket.IO
      io.close(() => {
        logger.info('server.shutdown', 'Socket.IO server closed')
      })

      // Close MongoDB
      await disconnectMongo()

      logger.info('server.shutdown', 'Graceful shutdown complete')
      process.exit(0)
    })

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('server.shutdown', 'Graceful shutdown timed out after 10s — forcing exit', {
        fix: 'Check for open database connections or pending async operations',
      })
      process.exit(1)
    }, 10_000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))

  // ── Socket.IO auth middleware ──────────────────────────────────────────────

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    const ip    = socketIp(socket)

    if (!token) {
      // Anonymous connection — allowed; canRead() gates per room
      ;(socket as any).user = null
      logger.debug('socket.auth', 'Anonymous socket connection', { socketId: socket.id, ip })
      return next()
    }

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as any
      ;(socket as any).user = { userId: payload.userId }
      logger.debug('socket.auth', 'Socket authenticated', { socketId: socket.id, userId: payload.userId })
      next()
    } catch (err) {
      // Expired or invalid token — treat as anonymous, not as a hard rejection.
      // This prevents public-page viewers from being kicked when their token expires.
      const isExpired = err instanceof jwt.TokenExpiredError
      logger.debug('socket.auth', isExpired
        ? 'Socket token expired — treating as anonymous'
        : 'Socket token invalid — treating as anonymous', {
        socketId: socket.id,
        ip,
        reason: (err as Error).message,
      })
      ;(socket as any).user = null
      next()
    }
  })

  // ── Socket.IO event handlers ───────────────────────────────────────────────

  type SavedState = {
    title?: string; content?: any; coverImageUrl?: string | null
    coverPosition?: number; icon?: string | null
  }

  const saveTimers   = new Map<string, NodeJS.Timeout>()
  const pendingState = new Map<string, SavedState>()
  const joinContext  = new Map<string, Map<string, { token?: string | null; canEdit: boolean }>>()
  const rateState    = new Map<string, { windowStart: number; count: number }>()
  const RATE_LIMIT_WINDOW_MS = 5_000
  const RATE_LIMIT_MAX       = 60

  io.on('connection', (socket) => {
    const uid = socketUserId(socket)
    const ip  = socketIp(socket)

    socketCtx(socket.id, uid, async () => {
      logger.info('socket.connect', 'Socket connected', {
        socketId: socket.id,
        userId:   uid ?? 'anonymous',
        ip,
        transport: socket.conn.transport.name,
      })
    })

    // ── page.join ────────────────────────────────────────────────────────────

    socket.on('page.join', async (payload: unknown) => {
      await socketCtx(socket.id, uid, async () => {
        // Guard against malformed event payload
        if (!payload || typeof payload !== 'object') {
          logger.warn('socket.page.join', 'Malformed page.join payload — expected object', {
            socketId: socket.id, userId: uid ?? 'anonymous',
            received: typeof payload,
          })
          socket.emit('page.error', { code: 'BAD_REQUEST', message: 'Invalid payload' })
          return
        }

        const { pageId, token } = payload as { pageId?: unknown; token?: unknown }

        if (!pageId) {
          logger.warn('socket.page.join', 'page.join called with missing pageId', {
            socketId: socket.id, userId: uid ?? 'anonymous',
          })
          socket.emit('page.error', { code: 'BAD_REQUEST', message: 'pageId is required' })
          return
        }

        if (typeof pageId !== 'string' || pageId.length === 0 || pageId.length > 64) {
          logger.warn('socket.page.join', 'page.join called with invalid pageId format', {
            socketId: socket.id, userId: uid ?? 'anonymous',
            pageIdType: typeof pageId, pageIdLength: typeof pageId === 'string' ? pageId.length : 'n/a',
          })
          socket.emit('page.error', { code: 'INVALID_ID', message: 'Invalid page ID format' })
          return
        }

        const shareToken = typeof token === 'string' ? token : null

        try {
          const page = await Page.findById(pageId).lean()
          if (!page) {
            logger.warn('socket.page.join', 'page.join for non-existent page', {
              socketId: socket.id, userId: uid ?? 'anonymous', pageId,
            })
            socket.emit('page.error', { code: 'NOT_FOUND', message: 'Page not found' })
            return
          }

          const readable = canRead(uid || null, page, shareToken)
          if (!readable) {
            logger.warn('socket.page.join', 'page.join denied — no read permission', {
              socketId:  socket.id,
              userId:    uid ?? 'anonymous',
              pageId,
              ip,
              isPublic:  page.isPublic,
              hasToken:  !!shareToken,
              reason:    !uid ? 'anonymous user, page is private' : 'user not in owner/sharedWith/collaborators and no valid token',
            })
            socket.emit('page.error', { code: 'FORBIDDEN', message: 'Access denied' })
            return
          }

          const editable   = canEdit(uid || null, page, shareToken)
          const accessType = uid && String(page.ownerId) === uid ? 'owner' : editable ? 'editor' : 'viewer'

          let sctx = joinContext.get(socket.id)
          if (!sctx) { sctx = new Map(); joinContext.set(socket.id, sctx) }
          sctx.set(pageId, { token: shareToken, canEdit: !!editable })
          socket.join(`page:${pageId}`)

          logger.info('socket.page.join', 'Joined page room', {
            socketId: socket.id, userId: uid ?? 'anonymous', pageId, accessType,
          })
        } catch (e) {
          logger.error('socket.page.join', `Unexpected error during page.join: ${(e as Error).message}`, {
            socketId: socket.id, userId: uid ?? 'anonymous', pageId,
            stack: (e as Error).stack,
            fix: 'Check MongoDB connectivity and that the pageId is a valid ObjectId',
          })
          socket.emit('page.error', { code: 'INTERNAL', message: 'Join failed' })
        }
      })
    })

    // ── page.edit ────────────────────────────────────────────────────────────

    socket.on('page.edit', async (payload: unknown) => {
      await socketCtx(socket.id, uid, async () => {
        if (!payload || typeof payload !== 'object') {
          logger.warn('socket.page.edit', 'Malformed page.edit payload', {
            socketId: socket.id, userId: uid ?? 'anonymous', received: typeof payload,
          })
          return
        }

        const { pageId, title, content, coverImageUrl, coverPosition, icon } = payload as any

        if (!pageId || typeof pageId !== 'string') {
          logger.warn('socket.page.edit', 'page.edit called with missing or invalid pageId', {
            socketId: socket.id, userId: uid ?? 'anonymous',
          })
          return
        }

        // ── Rate limit ───────────────────────────────────────────────────────
        const now = Date.now()
        const rs  = rateState.get(socket.id) ?? { windowStart: now, count: 0 }
        if (now - rs.windowStart > RATE_LIMIT_WINDOW_MS) { rs.windowStart = now; rs.count = 0 }
        rs.count += 1
        rateState.set(socket.id, rs)

        if (rs.count > RATE_LIMIT_MAX) {
          logger.warn('socket.page.edit', 'Rate limit exceeded on page.edit', {
            socketId: socket.id, userId: uid ?? 'anonymous', pageId,
            count: rs.count, windowMs: RATE_LIMIT_WINDOW_MS, limit: RATE_LIMIT_MAX,
          })
          socket.emit('page.error', { code: 'RATE_LIMITED', message: 'Too many edits. Please slow down.' })
          return
        }

        // ── Content size check ───────────────────────────────────────────────
        if (content !== undefined) {
          let sizeBytes = 0
          try { sizeBytes = Buffer.byteLength(JSON.stringify(content), 'utf8') } catch {}
          const LIMIT = 1 * 1024 * 1024
          if (sizeBytes > LIMIT) {
            logger.warn('socket.page.edit', 'page.edit content too large', {
              socketId: socket.id, userId: uid ?? 'anonymous', pageId,
              sizeBytes, limitBytes: LIMIT,
            })
            socket.emit('page.error', { code: 'CONTENT_TOO_LARGE', message: 'Content exceeds 1 MB limit' })
            return
          }
        }

        // ── Permission check ─────────────────────────────────────────────────
        try {
          const sctx = joinContext.get(socket.id)?.get(pageId) ?? null
          let allowed = false

          if (sctx) {
            allowed = sctx.canEdit
            if (!allowed) {
              logger.warn('socket.page.edit', 'page.edit denied — joined as viewer, not editor', {
                socketId: socket.id, userId: uid ?? 'anonymous', pageId,
              })
            }
          } else {
            // page.edit before page.join — reconnect race condition
            logger.warn('socket.page.edit', 'page.edit received before page.join — re-checking permission', {
              socketId: socket.id, userId: uid ?? 'anonymous', pageId,
              fix: 'Client should always emit page.join before page.edit',
            })
            const page = await Page.findById(pageId).lean()
            if (!page) {
              logger.warn('socket.page.edit', 'page.edit for non-existent page', {
                socketId: socket.id, userId: uid ?? 'anonymous', pageId,
              })
              return
            }
            allowed = canEdit(uid || null, page, null)
            if (!allowed) {
              logger.warn('socket.page.edit', 'page.edit denied — no edit permission (fallback check)', {
                socketId: socket.id, userId: uid ?? 'anonymous', pageId,
              })
            }
          }

          if (!allowed) return
        } catch (e) {
          logger.error('socket.page.edit', `Permission check failed: ${(e as Error).message}`, {
            socketId: socket.id, userId: uid ?? 'anonymous', pageId, stack: (e as Error).stack,
          })
          return
        }

        // ── Compute content size for logging ─────────────────────────────────
        const contentSizeBytes = content !== undefined
          ? (() => { try { return Buffer.byteLength(JSON.stringify(content), 'utf8') } catch { return 0 } })()
          : undefined

        logger.debug('socket.page.edit', 'Edit accepted', {
          socketId: socket.id, userId: uid ?? 'anonymous', pageId,
          ...(contentSizeBytes !== undefined ? { contentSizeBytes } : {}),
          fields: [
            title         !== undefined ? 'title'         : null,
            content       !== undefined ? 'content'       : null,
            coverImageUrl !== undefined ? 'coverImageUrl' : null,
            coverPosition !== undefined ? 'coverPosition' : null,
            icon          !== undefined ? 'icon'          : null,
          ].filter(Boolean),
        })

        // ── Broadcast + debounced save ────────────────────────────────────────
        const key  = `page:${pageId}`
        const prev = pendingState.get(pageId) ?? {}
        pendingState.set(pageId, {
          ...prev,
          ...(title         !== undefined ? { title }         : {}),
          ...(content       !== undefined ? { content }       : {}),
          ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
          ...(coverPosition !== undefined ? { coverPosition } : {}),
          ...(icon          !== undefined ? { icon }          : {}),
        })

        try {
          io.to(key).emit('page.updated', { pageId, title, content, coverImageUrl, coverPosition, icon })
        } catch (e) {
          logger.error('socket.page.edit', `Failed to broadcast page.updated to room ${key}`, {
            socketId: socket.id, userId: uid ?? 'anonymous', pageId,
            error: (e as Error).message,
          })
        }

        if (saveTimers.has(pageId)) clearTimeout(saveTimers.get(pageId)!)
        saveTimers.set(pageId, setTimeout(async () => {
          try {
            const state = pendingState.get(pageId)
            pendingState.delete(pageId)
            if (!state) return

            const page = await Page.findById(pageId)
            if (!page) {
              logger.warn('socket.autosave', 'Autosave skipped — page no longer exists', { pageId })
              return
            }

            if (state.title         !== undefined) (page as any).title         = state.title
            if (state.content       !== undefined) (page as any).content       = state.content
            if (state.coverImageUrl !== undefined) (page as any).coverImageUrl = state.coverImageUrl
            if (state.coverPosition !== undefined) (page as any).coverPosition = state.coverPosition
            if (state.icon          !== undefined) (page as any).icon          = state.icon

            await page.save()
            logger.debug('socket.autosave', 'Page autosaved', { pageId })

            if (state.title !== undefined || state.icon !== undefined) {
              let targets = Array.isArray((page as any).ancestors)
                ? (page as any).ancestors.map((a: any) => String(a))
                : []
              if (!targets.length && (page as any).parentId) targets = [String((page as any).parentId)]
              if (targets.length) {
                emitSubpageMetaToAncestors(targets, {
                  pageId: String(page._id),
                  ...(state.title !== undefined ? { title: state.title } : {}),
                  ...(state.icon  !== undefined ? { icon:  state.icon  } : {}),
                })
              }
            }
          } catch (e) {
            const msg = (e as Error).message ?? String(e)
            // Classify DB errors for actionable messages
            if (msg.includes('ECONNREFUSED') || msg.includes('MongoNetworkError')) {
              logger.error('socket.autosave', 'Autosave failed — MongoDB connection lost', {
                pageId, error: msg,
                fix: 'Check MongoDB connectivity. Pending changes may be lost.',
              })
            } else if ((e as any)?.code === 11000) {
              logger.error('socket.autosave', 'Autosave failed — duplicate key conflict', {
                pageId, error: msg,
                fix: 'A slug collision occurred. Check slug generation logic.',
              })
            } else {
              logger.error('socket.autosave', `Autosave failed: ${msg}`, {
                pageId, stack: (e as Error).stack,
              })
            }
          }
        }, 800))
      })
    })

    // ── disconnect ────────────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      socketCtx(socket.id, uid, async () => {
        const rooms = Array.from(joinContext.get(socket.id)?.keys() ?? [])
        const isUnexpected = reason === 'transport error' || reason === 'transport close'

        if (isUnexpected) {
          logger.warn('socket.disconnect', 'Socket disconnected unexpectedly', {
            socketId: socket.id, userId: uid ?? 'anonymous', reason, rooms,
            fix: 'Check client network stability and server-side transport configuration',
          })
        } else {
          logger.info('socket.disconnect', 'Socket disconnected', {
            socketId: socket.id, userId: uid ?? 'anonymous', reason, rooms,
          })
        }

        joinContext.delete(socket.id)
        rateState.delete(socket.id)
      })
    })

    socket.on('error', (err: Error) => {
      socketCtx(socket.id, uid, async () => {
        logger.error('socket.error', `Socket error: ${err.message}`, {
          socketId: socket.id, userId: uid ?? 'anonymous',
          stack: err.stack,
        })
      })
    })
  })

  // ── Start listening ────────────────────────────────────────────────────────

  await new Promise<void>((resolve, reject) => {
    server.listen(env.PORT, () => resolve())
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error('server.start', `FATAL — Port ${env.PORT} is already in use`, {
          port: env.PORT,
          fix:  `Either stop the process using port ${env.PORT} or change PORT in .env`,
        })
      } else if (err.code === 'EACCES') {
        logger.error('server.start', `FATAL — Permission denied to bind port ${env.PORT}`, {
          port: env.PORT,
          fix:  `Ports below 1024 require root. Use a port >= 1024 or run with elevated privileges.`,
        })
      } else {
        logger.error('server.start', `FATAL — Failed to start HTTP server: ${err.message}`, {
          port: env.PORT, code: err.code, stack: err.stack,
        })
      }
      reject(err)
    })
  })

  logger.info('server.start', `Motion API listening on http://localhost:${env.PORT}`, {
    port:    env.PORT,
    nodeEnv: env.NODE_ENV,
    cors:    env.CORS_ORIGIN,
  })

  // ── Connect to MongoDB ─────────────────────────────────────────────────────
  // Non-blocking — server accepts requests while connecting.
  // The DB connection has its own retry/reconnect logic.

  connectMongo()
    .then(() => logger.info('server.start', 'MongoDB connected and ready'))
    .catch((err) => {
      logger.error('server.start', `MongoDB failed to connect on startup: ${(err as Error).message}`, {
        fix: 'Check MONGO_URI, network connectivity, and MongoDB Atlas status. Server will continue but DB operations will fail.',
      })
      // Do not exit — let the server run so health checks can still respond
    })
}

main().catch((err: Error) => {
  logger.error('server.fatal', `Fatal error during startup: ${err.message}`, {
    stack: err.stack,
    fix:   'Check the error above and fix the configuration or code issue before restarting',
  })
  process.exit(1)
})
