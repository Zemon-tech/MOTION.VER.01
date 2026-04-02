import { useEffect, useState } from 'react'
import { Layout } from './components/Layout'
import { Header } from './components/Header'
import { AppSidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { AuthPage } from './components/Auth'
import { useNavigate } from 'react-router-dom'
import { api, apiBase } from './lib/utils'
import { isApiError, ErrorCodes } from './lib/apiError'

const IS_DEV = (import.meta as any).env?.DEV === true

/** Only log errors that are genuinely unexpected — not 401s or 404s from normal app flow */
function logUnexpected(context: string, err: unknown): void {
  if (!IS_DEV) return
  if (isApiError(err)) {
    const silent = new Set([
      ErrorCodes.NOT_FOUND,
      ErrorCodes.TOKEN_EXPIRED,
      ErrorCodes.TOKEN_MISSING,
      ErrorCodes.UNAUTHORIZED,
    ])
    if (silent.has(err.code as any)) return
    console.debug(`[App] ${context}:`, err.code, err.message)
  } else {
    console.debug(`[App] ${context}:`, err)
  }
}

async function navigateToFirstPage(navigate: (path: string) => void): Promise<void> {
  try {
    const pagesData = await api('/pages')
    const pages = pagesData?.pages ?? []
    if (pages.length > 0) {
      const p = pages[0]
      navigate(`/${p.slug || `${p.title.toLowerCase().replace(/\s+/g, '-')}-${p._id}`}`)
    } else {
      const newPage = await api('/pages', {
        method: 'POST',
        body: JSON.stringify({ title: 'Welcome to Motion' }),
      })
      if (newPage?.slug) navigate(`/${newPage.slug}`)
    }
  } catch (err) {
    logUnexpected('navigateToFirstPage', err)
  }
}

async function navigateAfterLogin(navigate: (path: string) => void): Promise<void> {
  // 1. Try cached last page
  try {
    const lastPage = localStorage.getItem('lastPage')
    if (lastPage) {
      const pageData = JSON.parse(lastPage)
      if (pageData?.slug) {
        const r = await api(`/pages/slug/${pageData.slug}`)
        if (r?.page) { navigate(`/${pageData.slug}`); return }
        localStorage.removeItem('lastPage')
      }
    }
  } catch {
    localStorage.removeItem('lastPage')
  }

  // 2. Try server last-page
  try {
    const lastPageData = await api('/users/last-page')
    if (lastPageData?.lastPage?.slug) {
      localStorage.setItem('lastPage', JSON.stringify(lastPageData.lastPage))
      navigate(`/${lastPageData.lastPage.slug}`)
      return
    }
  } catch (err) {
    // NOT_FOUND = new user with no pages — expected, fall through silently
    if (isApiError(err) && err.code !== ErrorCodes.NOT_FOUND) {
      logUnexpected('users/last-page', err)
    }
  }

  // 3. Fall back to first/new page
  await navigateToFirstPage(navigate)
}

function App() {
  const [title, setTitle]           = useState('Untitled')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [, setUser]                 = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token      = localStorage.getItem('accessToken')
    const cachedUser = localStorage.getItem('user')

    if (token && cachedUser && cachedUser !== 'undefined' && cachedUser !== 'null') {
      setAccessToken(token)
      try {
        setUser(JSON.parse(cachedUser))
      } catch {
        localStorage.removeItem('user')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('lastPage')
        return
      }
      navigateAfterLogin(navigate)
      return
    }

    // No token — attempt silent refresh from httpOnly cookie
    // A 401 here just means the user is logged out — completely expected, no logging
    fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        if (!data?.accessToken) return  // logged out — show login page, no error

        localStorage.setItem('accessToken', data.accessToken)
        setAccessToken(data.accessToken)

        // Fetch user profile
        const userRes = await fetch(`${apiBase}/users/me`, {
          headers: { Authorization: `Bearer ${data.accessToken}` },
          credentials: 'include',
        })
        if (!userRes.ok) return
        const userData = await userRes.json()
        if (userData?.user) {
          localStorage.setItem('user', JSON.stringify(userData.user))
          setUser(userData.user)
          await navigateAfterLogin(navigate)
        }
      })
      .catch((err) => {
        // Network error on refresh — expected when offline, no logging needed
        if (IS_DEV && !(err instanceof TypeError)) {
          console.debug('[App] auth/refresh unexpected error:', err)
        }
      })
  }, [navigate])

  useEffect(() => {
    const onAuthUpdated = () => {
      const token = localStorage.getItem('accessToken')
      setAccessToken(token)
      const cachedUser = localStorage.getItem('user')
      if (cachedUser && cachedUser !== 'undefined' && cachedUser !== 'null') {
        try { setUser(JSON.parse(cachedUser)) } catch { setUser(null) }
      } else {
        setUser(null)
      }
    }
    window.addEventListener('auth-updated', onAuthUpdated)
    return () => window.removeEventListener('auth-updated', onAuthUpdated)
  }, [])

  return accessToken ? (
    <Layout header={<Header title={title} />} sidebar={<AppSidebar />}>
      <div className="h-full">
        <Editor title={title} onTitleChange={setTitle} />
      </div>
    </Layout>
  ) : (
    <AuthPage />
  )
}

export default App
