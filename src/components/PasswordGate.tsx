import { useState } from 'react'
import { ShaderAnimation } from '@/components/ui/shader-animation'

type PasswordGateProps = {
  message?: string
  onSubmit: (password: string) => Promise<void>
  busy?: boolean
}

export function PasswordGate({ message = 'This page is locked. Enter the password to view.', onSubmit, busy = false }: PasswordGateProps) {
  const [pwd, setPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pwd) return
    setLoading(true)
    setError(null)
    try {
      await onSubmit(pwd)
    } catch (err: any) {
      setError('Invalid password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <ShaderAnimation />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border bg-background/95 backdrop-blur-md p-4 shadow-xl">
          <div className="text-sm text-muted-foreground mb-2">{message}</div>
          <input
            type="password"
            className="w-full border rounded px-3 py-2 bg-background"
            placeholder="Enter password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            disabled={loading || busy}
            autoFocus
          />
          {error ? <div className="text-xs text-red-600 mt-2">{error}</div> : null}
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              type="submit"
              disabled={loading || busy || !pwd}
              className="inline-flex items-center px-3 py-1.5 rounded border text-sm hover:bg-accent disabled:opacity-60"
            >
              {loading ? 'Verifying…' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
