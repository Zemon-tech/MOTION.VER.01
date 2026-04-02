/**
 * Environment validation — runs once at process start, before anything else.
 *
 * Every missing or malformed variable produces a FATAL log that tells the
 * developer exactly which variable is wrong and exactly how to fix it.
 * The process exits immediately after printing all failures (not just the first).
 *
 * Import this as the very first line of server.ts, before any other imports
 * that might read process.env.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnvRule {
  key: string
  required: boolean
  validate?: (value: string) => string | null  // returns error string or null if ok
  fix: string
  defaultValue?: string
  warnIfMissing?: boolean  // warn but don't exit
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidMongoUri(uri: string): string | null {
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    return 'Must start with mongodb:// or mongodb+srv://'
  }
  if (uri.length < 20) return 'URI is too short to be valid'
  return null
}

function isValidPort(value: string): string | null {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    return `"${value}" is not a valid port number (must be 1–65535)`
  }
  return null
}

function isValidNodeEnv(value: string): string | null {
  const valid = ['development', 'production', 'test']
  if (!valid.includes(value)) {
    return `"${value}" is not a recognised NODE_ENV. Use: ${valid.join(', ')}`
  }
  return null
}

function isValidUrl(value: string): string | null {
  try {
    new URL(value)
    return null
  } catch {
    return `"${value}" is not a valid URL`
  }
}

// ─── Rules ────────────────────────────────────────────────────────────────────

const RULES: EnvRule[] = [
  {
    key: 'MONGO_URI',
    required: true,
    validate: isValidMongoUri,
    fix: 'Set MONGO_URI in .env — e.g. MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname',
  },
  {
    key: 'JWT_ACCESS_SECRET',
    required: true,
    validate: (v) => v.length < 32 ? 'Must be at least 32 characters for security' : null,
    fix: 'Set JWT_ACCESS_SECRET in .env — run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  },
  {
    key: 'JWT_REFRESH_SECRET',
    required: true,
    validate: (v) => v.length < 32 ? 'Must be at least 32 characters for security' : null,
    fix: 'Set JWT_REFRESH_SECRET in .env — must be DIFFERENT from JWT_ACCESS_SECRET',
  },
  {
    key: 'PORT',
    required: false,
    defaultValue: '4000',
    validate: isValidPort,
    fix: 'Set PORT in .env to a valid integer between 1 and 65535 — e.g. PORT=4000',
  },
  {
    key: 'NODE_ENV',
    required: false,
    defaultValue: 'development',
    validate: isValidNodeEnv,
    fix: 'Set NODE_ENV in .env to one of: development, production, test',
  },
  {
    key: 'CORS_ORIGIN',
    required: false,
    defaultValue: 'http://localhost:5173',
    validate: isValidUrl,
    fix: 'Set CORS_ORIGIN in .env to the full frontend URL — e.g. CORS_ORIGIN=https://app.example.com',
    warnIfMissing: true,
  },
  {
    key: 'JWT_SECRET',
    required: false,
    defaultValue: 'secret',
    validate: (v) => v === 'secret' && process.env.NODE_ENV === 'production'
      ? 'JWT_SECRET is set to the insecure default "secret" in production'
      : null,
    fix: 'Set JWT_SECRET in .env to a strong random string (used for unlock tokens)',
    warnIfMissing: true,
  },
]

// ─── Fatal logger (used before the main logger is available) ──────────────────

function fatal(message: string, fix: string): void {
  const ts = new Date().toISOString()
  process.stderr.write(`${ts} \x1b[31mFATAL\x1b[0m [env.validate] ${message}\n`)
  process.stderr.write(`${ts} \x1b[33m  Fix\x1b[0m : ${fix}\n`)
}

function warn(message: string, fix: string): void {
  const ts = new Date().toISOString()
  process.stderr.write(`${ts} \x1b[33mWARN \x1b[0m [env.validate] ${message}\n`)
  process.stderr.write(`${ts} \x1b[2m  Fix\x1b[0m : ${fix}\n`)
}

// ─── Validate ─────────────────────────────────────────────────────────────────

export function validateEnv(): void {
  let failures = 0

  for (const rule of RULES) {
    const raw = process.env[rule.key]

    // Missing
    if (raw === undefined || raw === '') {
      if (rule.required) {
        fatal(`${rule.key} is not set`, rule.fix)
        failures++
        continue
      }
      if (rule.warnIfMissing) {
        warn(`${rule.key} is not set — using default "${rule.defaultValue}"`, rule.fix)
      }
      // Apply default so downstream code can read it
      if (rule.defaultValue !== undefined) {
        process.env[rule.key] = rule.defaultValue
      }
      continue
    }

    // Present — run validator
    if (rule.validate) {
      const err = rule.validate(raw)
      if (err) {
        if (rule.required) {
          fatal(`${rule.key} is invalid: ${err}`, rule.fix)
          failures++
        } else {
          warn(`${rule.key} may be misconfigured: ${err}`, rule.fix)
        }
      }
    }
  }

  // Cross-field checks
  if (
    process.env.JWT_ACCESS_SECRET &&
    process.env.JWT_REFRESH_SECRET &&
    process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET
  ) {
    fatal(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are identical — this is a security vulnerability',
      'Generate two separate secrets: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
    failures++
  }

  if (failures > 0) {
    process.stderr.write(
      `\n\x1b[31m${failures} required environment variable(s) are missing or invalid. Exiting.\x1b[0m\n\n`,
    )
    process.exit(1)
  }
}

// ─── Typed accessor (safe after validateEnv() has run) ───────────────────────

export const env = {
  get MONGO_URI()           { return process.env.MONGO_URI! },
  get JWT_ACCESS_SECRET()   { return process.env.JWT_ACCESS_SECRET! },
  get JWT_REFRESH_SECRET()  { return process.env.JWT_REFRESH_SECRET! },
  get JWT_SECRET()          { return process.env.JWT_SECRET ?? 'secret' },
  get PORT()                { return Number(process.env.PORT ?? 4000) },
  get NODE_ENV()            { return process.env.NODE_ENV ?? 'development' },
  get CORS_ORIGIN()         { return process.env.CORS_ORIGIN ?? 'http://localhost:5173' },
  get IS_PROD()             { return process.env.NODE_ENV === 'production' },
  get FILE_MAX_SIZE_BYTES() { return Number(process.env.FILE_MAX_SIZE_BYTES ?? 5 * 1024 * 1024) },
}
