/**
 * MongoDB connection with full lifecycle logging.
 *
 * Every state transition — connecting, connected, disconnected, error,
 * reconnecting — produces a log line that tells the on-call engineer
 * exactly what happened and what to do.
 */

import mongoose from 'mongoose'
import { logger } from '../utils/logger'
import { redactMongoUri } from '../utils/dbError'

// Track whether we've connected at least once (to distinguish initial failure
// from mid-session disconnect).
let hasConnectedOnce = false

export async function connectMongo(): Promise<typeof mongoose> {
  const uri = process.env.MONGO_URI
  if (!uri) {
    // env.ts should have caught this — this is a safety net
    logger.error('db.connect', 'MONGO_URI is not set — cannot connect to MongoDB', {
      fix: 'Set MONGO_URI in .env and restart the server',
    })
    throw new Error('MONGO_URI is not set')
  }

  const safeUri = redactMongoUri(uri)

  // ── Mongoose event listeners ───────────────────────────────────────────────

  mongoose.connection.on('connecting', () => {
    logger.info('db.connect', `Connecting to MongoDB at ${safeUri}`)
  })

  mongoose.connection.on('connected', () => {
    hasConnectedOnce = true
    logger.info('db.connect', `MongoDB connected — host: ${safeUri}`)
  })

  mongoose.connection.on('open', () => {
    logger.debug('db.connect', 'MongoDB connection open and ready for queries')
  })

  mongoose.connection.on('disconnected', () => {
    if (hasConnectedOnce) {
      logger.error('db.connect', 'MongoDB disconnected unexpectedly', {
        host: safeUri,
        fix:  'Check network connectivity and MongoDB Atlas status. Mongoose will attempt to reconnect automatically.',
      })
    }
  })

  mongoose.connection.on('reconnected', () => {
    logger.info('db.connect', `MongoDB reconnected — host: ${safeUri}`)
  })

  mongoose.connection.on('error', (err: Error) => {
    const msg = err.message ?? String(err)

    // Classify the error for a more actionable message
    if (msg.includes('ECONNREFUSED')) {
      logger.error('db.connect', 'MongoDB connection refused — server is not running or port is wrong', {
        host: safeUri,
        error: msg,
        fix:  'Ensure MongoDB is running and the host/port in MONGO_URI are correct',
      })
    } else if (msg.includes('Authentication failed') || msg.includes('auth failed') || msg.includes('Unauthorized')) {
      logger.error('db.connect', 'MongoDB authentication failed — wrong username or password', {
        host: safeUri,
        fix:  'Check the username and password in MONGO_URI. For Atlas, verify the database user credentials.',
      })
    } else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      logger.error('db.connect', 'MongoDB host not found — DNS resolution failed', {
        host: safeUri,
        error: msg,
        fix:  'Check the hostname in MONGO_URI. For Atlas, ensure your network can reach MongoDB Atlas.',
      })
    } else if (msg.includes('timed out') || msg.includes('ETIMEDOUT')) {
      logger.error('db.connect', 'MongoDB connection timed out — host unreachable or network issue', {
        host: safeUri,
        error: msg,
        fix:  'Check network connectivity, firewall rules, and Atlas IP whitelist (Network Access in Atlas dashboard)',
      })
    } else if (msg.includes('SSL') || msg.includes('TLS') || msg.includes('certificate')) {
      logger.error('db.connect', 'MongoDB TLS/SSL error', {
        host: safeUri,
        error: msg,
        fix:  'Check TLS settings in MONGO_URI. For Atlas, ensure tls=true is set.',
      })
    } else {
      logger.error('db.connect', `MongoDB connection error: ${msg}`, {
        host: safeUri,
        fix:  'Check MONGO_URI and MongoDB server status',
      })
    }
  })

  mongoose.connection.on('close', () => {
    logger.warn('db.connect', 'MongoDB connection closed')
  })

  // ── Connect ────────────────────────────────────────────────────────────────

  mongoose.set('strictQuery', true)

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,  // fail fast on startup
      socketTimeoutMS:          45_000,
      connectTimeoutMS:         10_000,
    })
    return mongoose
  } catch (err: unknown) {
    const e = err as Error
    const msg = e.message ?? String(err)

    if (msg.includes('ECONNREFUSED')) {
      logger.error('db.connect', 'FATAL — MongoDB refused connection on startup', {
        host: safeUri,
        fix:  'Start MongoDB or check the host/port in MONGO_URI',
      })
    } else if (msg.includes('Authentication failed') || msg.includes('auth failed')) {
      logger.error('db.connect', 'FATAL — MongoDB authentication failed on startup', {
        host: safeUri,
        fix:  'Verify the username and password in MONGO_URI',
      })
    } else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      logger.error('db.connect', 'FATAL — MongoDB hostname not found on startup', {
        host: safeUri,
        error: msg,
        fix:  'Check the hostname in MONGO_URI and your DNS/network configuration',
      })
    } else if (msg.includes('Server selection timed out') || msg.includes('ETIMEDOUT')) {
      logger.error('db.connect', 'FATAL — MongoDB server selection timed out on startup', {
        host: safeUri,
        fix:  'Check network connectivity, Atlas IP whitelist, and that the cluster is not paused',
      })
    } else {
      logger.error('db.connect', `FATAL — MongoDB failed to connect on startup: ${msg}`, {
        host:  safeUri,
        stack: e.stack,
        fix:   'Check MONGO_URI and MongoDB server status',
      })
    }

    throw err
  }
}

/** Gracefully close the connection (called on SIGTERM/SIGINT) */
export async function disconnectMongo(): Promise<void> {
  try {
    await mongoose.connection.close()
    logger.info('db.connect', 'MongoDB connection closed gracefully')
  } catch (err) {
    logger.error('db.connect', 'Error closing MongoDB connection', {
      error: (err as Error).message,
    })
  }
}
