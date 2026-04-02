import { useEffect } from 'react'
import { api } from '@/lib/utils'
import { ShaderAnimation } from '@/components/ui/shader-animation'
import { Logo } from '@/components/Logo'
import { setFavicon } from '@/lib/meta'
import { useNavigate } from 'react-router-dom'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { ErrorCodes } from '@/lib/apiError'
import * as React from 'react'

type Mode = 'login' | 'signup'

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error ? (
        <p className="text-xs text-red-500 leading-snug">{error}</p>
      ) : null}
    </div>
  )
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function Banner({
  message,
  requestId,
  variant = 'error',
}: {
  message: string
  requestId?: string
  variant?: 'error' | 'warning'
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2.5 text-sm ${
        variant === 'warning'
          ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
          : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
      }`}
    >
      <p>{message}</p>
      {requestId ? (
        <p className="mt-1 text-xs opacity-60 font-mono">Ref: {requestId}</p>
      ) : null}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuthPage() {
  const [mode, setMode]       = React.useState<Mode>('login')
  const [email, setEmail]     = React.useState('')
  const [password, setPassword] = React.useState('')
  const [name, setName]       = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const navigate = useNavigate()

  const { error, fieldError, handleError, clearError, clearFieldError } = useErrorHandler()

  useEffect(() => { setFavicon() }, [])

  // Switch mode → clear all errors
  function switchMode(next: Mode) {
    setMode(next)
    clearError()
  }

  // ── Per-field error routing ────────────────────────────────────────────────
  // Some backend codes map to a specific field rather than a banner.
  // We synthesise a field error so it appears under the right input.

  function emailFieldError(): string | undefined {
    // Explicit field error from VALIDATION_ERROR
    const fe = fieldError('email')
    if (fe) return fe
    // Code-level routing
    if (!error) return undefined
    if (error.code === ErrorCodes.USER_NOT_FOUND) return 'No account found with this email address.'
    if (error.code === ErrorCodes.EMAIL_TAKEN || error.code === ErrorCodes.CONFLICT)
      return 'An account with this email already exists.'
    return undefined
  }

  function passwordFieldError(): string | undefined {
    const fe = fieldError('password')
    if (fe) return fe
    if (!error) return undefined
    if (
      error.code === ErrorCodes.WRONG_PASSWORD ||
      error.code === ErrorCodes.INVALID_CREDENTIALS
    )
      return 'Incorrect password. Please try again.'
    return undefined
  }

  // ── Banner routing ─────────────────────────────────────────────────────────
  // Only show a banner for errors that aren't fully handled by field errors.

  function resolvedBanner(): { message: string; variant: 'error' | 'warning'; requestId?: string } | null {
    if (!error) return null

    // These are fully handled by field-level display — no banner needed
    const fieldOnlyCodes = new Set([
      ErrorCodes.WRONG_PASSWORD,
      ErrorCodes.INVALID_CREDENTIALS,
      ErrorCodes.USER_NOT_FOUND,
      ErrorCodes.EMAIL_TAKEN,
      ErrorCodes.CONFLICT,
    ])
    if (fieldOnlyCodes.has(error.code as any)) return null

    // VALIDATION_ERROR — only show banner if there are no field errors
    if (error.code === ErrorCodes.VALIDATION_ERROR) {
      const hasFieldErrors = error.fields && Object.keys(error.fields).length > 0
      return hasFieldErrors ? null : { message: error.message, variant: 'error' }
    }

    if (error.code === ErrorCodes.TOKEN_EXPIRED)
      return { message: 'Your session expired. Please sign in again.', variant: 'warning' }

    if (error.code === ErrorCodes.NETWORK_ERROR)
      return { message: 'Cannot connect to server. Check your connection and try again.', variant: 'error' }

    if (
      error.code === ErrorCodes.INTERNAL_ERROR ||
      error.code === ErrorCodes.INTERNAL_SERVER_ERROR
    )
      return {
        message: 'Something went wrong on our end. Please try again shortly.',
        variant: 'error',
        requestId: error.requestId,
      }

    // Any other code — show the backend message directly, never a hardcoded fallback
    const isUnexpected = error.statusCode >= 500
    return {
      message: error.message,
      variant: 'error',
      requestId: isUnexpected ? error.requestId : undefined,
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setLoading(true)
    try {
      if (mode === 'signup') {
        const res = await api<{ user: any; accessToken: string }>('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, name: name.trim() || undefined }),
          public: true,
        })
        localStorage.setItem('accessToken', res.accessToken)
        localStorage.setItem('user', JSON.stringify(res.user))
        window.dispatchEvent(new Event('auth-updated'))
        navigate('/')
      } else {
        const res = await api<{ user: any; accessToken: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
          public: true,
        })
        localStorage.setItem('accessToken', res.accessToken)
        localStorage.setItem('user', JSON.stringify(res.user))
        window.dispatchEvent(new Event('auth-updated'))
        navigate('/')
      }
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  const banner = resolvedBanner()

  return (
    <div className="min-h-svh grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr]">
      <div className="relative hidden md:block">
        <ShaderAnimation />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
      </div>

      <div className="relative flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm rounded-2xl border bg-background/80 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="p-6 md:p-7">

            {/* Header */}
            <div className="mb-6">
              <div className="mb-2 text-center">
                <Logo size={40} className="text-foreground" />
              </div>
              <h1 className="text-2xl font-semibold text-center tracking-tight">
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                {mode === 'signup'
                  ? 'Start crafting beautiful pages in minutes'
                  : 'Sign in to continue to Motion'}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`rounded-md py-2 font-medium transition ${mode === 'login' ? 'bg-background shadow' : 'opacity-70 hover:opacity-100'}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`rounded-md py-2 font-medium transition ${mode === 'signup' ? 'bg-background shadow' : 'opacity-70 hover:opacity-100'}`}
              >
                Sign up
              </button>
            </div>

            {/* Banner errors */}
            {banner ? (
              <div className="mb-4">
                <Banner
                  message={banner.message}
                  requestId={banner.requestId}
                  variant={banner.variant}
                />
              </div>
            ) : null}

            <form onSubmit={submit} className="space-y-4">
              {/* Name — signup only */}
              {mode === 'signup' ? (
                <Field label="Name">
                  <input
                    className="w-full rounded-lg border bg-background px-3 py-2 outline-none ring-0 focus-visible:border-foreground/60"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </Field>
              ) : null}

              {/* Email */}
              <Field label="Email" error={emailFieldError()}>
                <input
                  className={`w-full rounded-lg border bg-background px-3 py-2 outline-none ring-0 focus-visible:border-foreground/60 ${emailFieldError() ? 'border-red-400 focus-visible:border-red-500' : ''}`}
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearFieldError('email')
                  }}
                />
              </Field>

              {/* Password */}
              <Field label="Password" error={passwordFieldError()}>
                <input
                  className={`w-full rounded-lg border bg-background px-3 py-2 outline-none ring-0 focus-visible:border-foreground/60 ${passwordFieldError() ? 'border-red-400 focus-visible:border-red-500' : ''}`}
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    clearFieldError('password')
                  }}
                />
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-lg bg-foreground px-3 py-2 font-medium text-background transition hover:opacity-90 disabled:opacity-70"
              >
                {loading
                  ? 'Please wait…'
                  : mode === 'signup'
                  ? 'Create account'
                  : 'Sign in'}
              </button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === 'signup' ? (
                <button type="button" className="underline" onClick={() => switchMode('login')}>
                  Have an account? Sign in
                </button>
              ) : (
                <button type="button" className="underline" onClick={() => switchMode('signup')}>
                  New here? Create account
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
