import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/utils'

export function GoogleAuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const code = searchParams.get('code')

  useEffect(() => {
    if (code) {
      api('/google/auth/tokens', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
        .then(() => {
          // Success, go back to where we came from or home
          navigate('/home')
        })
        .catch(() => {
          navigate('/home?error=google_auth_failed')
        })
    } else {
      navigate('/home')
    }
  }, [code, navigate])

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
        <h1 className="text-xl font-semibold">Authenticating with Google...</h1>
        <p className="text-muted-foreground">Please wait while we finalize your connection.</p>
      </div>
    </div>
  )
}
