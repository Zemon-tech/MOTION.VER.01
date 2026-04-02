import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ApiError } from './apiError'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const apiBase =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.VITE_API_BASE ||
  'http://localhost:4000/api'

const IS_DEV = (import.meta as any).env?.DEV === true

// ─── Dev-only logger ──────────────────────────────────────────────────────────
// Never logs in production. Never logs tokens or passwords.

function devLog(path: string, status: number, code: string, message: string): void {
  if (!IS_DEV) return
  const label = status >= 500 ? 'color:red' : status >= 400 ? 'color:orange' : 'color:green'
  console.debug(`%cAPI ${path} → ${status} ${code}: ${message}`, label)
}

// ─── Parse backend error envelope ────────────────────────────────────────────

async function parseError(res: Response, path: string): Promise<ApiError> {
  let body: any = {}
  try { body = await res.json() } catch { /* empty body */ }

  const e = body?.error ?? {}
  const code      = e.code    ?? (res.status === 429 ? 'TOO_MANY_REQUESTS' : 'INTERNAL_SERVER_ERROR')
  const message   = e.message ?? `Request failed (${res.status})`
  const fields    = e.fields  as Record<string, string> | undefined
  const requestId = e.requestId as string | undefined

  devLog(path, res.status, code, message)

  return new ApiError(code, message, res.status, fields, requestId)
}

// ─── Token refresh (internal, called once per 401) ────────────────────────────

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const r = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!r.ok) return null
      const data = await r.json()
      const token = data?.accessToken ?? null
      if (token) localStorage.setItem('accessToken', token)
      return token
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

export interface ApiOptions extends RequestInit {
  /** If true, skip attaching the Authorization header (public endpoints) */
  public?: boolean
  /** If true, skip the automatic token refresh on 401 */
  skipRefresh?: boolean
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { public: isPublic = false, skipRefresh = false, ...fetchOptions } = options

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  }

  // Only attach auth header when we have a token AND the endpoint isn't explicitly public
  if (token && !isPublic) {
    headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      ...fetchOptions,
      headers,
    })
  } catch (networkErr) {
    // fetch() itself threw — no network connection
    if (IS_DEV) console.debug(`API ${path} → NETWORK_ERROR: ${(networkErr as Error).message}`)
    throw new ApiError('NETWORK_ERROR', 'Cannot connect to server. Check your connection.', 0)
  }

  // ── 401 with a token → try refresh once ───────────────────────────────────
  if (res.status === 401 && token && !skipRefresh) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      // Retry with the new token
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` }
      try {
        const retryRes = await fetch(`${apiBase}${path}`, {
          credentials: 'include',
          ...fetchOptions,
          headers: retryHeaders,
        })
        if (retryRes.ok) {
          if (retryRes.status === 204 || retryRes.headers.get('content-length') === '0') return {} as T
          return retryRes.json()
        }
        // Retry also failed — fall through to error handling below
        res = retryRes
      } catch {
        throw new ApiError('NETWORK_ERROR', 'Cannot connect to server. Check your connection.', 0)
      }
    }
    // Refresh failed or no new token — fall through to throw the 401
  }

  if (!res.ok) {
    throw await parseError(res, path)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return {} as T
  return res.json()
}

// ─── Convenience methods ──────────────────────────────────────────────────────

export const apiGet    = <T = any>(path: string, opts?: ApiOptions) => api<T>(path, { method: 'GET',    ...opts })
export const apiPost   = <T = any>(path: string, body: unknown, opts?: ApiOptions) => api<T>(path, { method: 'POST',   body: JSON.stringify(body), ...opts })
export const apiPatch  = <T = any>(path: string, body: unknown, opts?: ApiOptions) => api<T>(path, { method: 'PATCH',  body: JSON.stringify(body), ...opts })
export const apiDelete = <T = any>(path: string, opts?: ApiOptions) => api<T>(path, { method: 'DELETE', ...opts })
