import { useEffect, useState } from 'react'
import { Layout } from './components/Layout'
import { Header } from './components/Header'
import { AppSidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { AuthPage } from './components/Auth'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, apiBase } from './lib/utils'
import { usePageCreationLimit, usePageCreationCountdown } from './hooks/use-page-creation-limit'
import { RateLimitBanner } from './components/RateLimitBanner'

function App() {
  const [title, setTitle] = useState('Untitled')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [, setUser] = useState<any>(null)
  const navigate = useNavigate()
  const setBlocked = usePageCreationLimit((s) => s.setBlocked)
  usePageCreationCountdown()
  
  useEffect(() => {
    // Check localStorage first for instant login
    const token = localStorage.getItem('accessToken')
    const cachedUser = localStorage.getItem('user')
    
    if (token && cachedUser && cachedUser !== 'undefined' && cachedUser !== 'null') {
      setAccessToken(token)
      try {
        setUser(JSON.parse(cachedUser))
      } catch (e) {
        console.error('Error parsing cached user:', e)
        // Clear invalid data
        localStorage.removeItem('user')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('lastPage')
      }
      
      // Check if we should navigate to last page
      const lastPage = localStorage.getItem('lastPage')
      if (lastPage) {
        try {
          const pageData = JSON.parse(lastPage)
          if (pageData.slug) {
            // Validate the cached slug first to avoid infinite 404 loops
            api(`/pages/slug/${pageData.slug}`)
              .then((r) => {
                if (r && r.page) {
                  navigate(`/${pageData.slug}`)
                } else {
                  // Unexpected response; clear and continue fallback
                  localStorage.removeItem('lastPage')
                }
              })
              .catch(() => {
                // Stale slug -> clear and continue fallback to server
                localStorage.removeItem('lastPage')
              })
            // Do not early return; allow fallback chain to run if validation fails
          }
        } catch (e) {
          // Invalid lastPage data, ignore
          localStorage.removeItem('lastPage')
        }
      }
      
      // If no last page in localStorage, try to get from server
      api('/users/last-page')
        .then((lastPageData) => {
          if (lastPageData?.lastPage?.slug) {
            localStorage.setItem('lastPage', JSON.stringify(lastPageData.lastPage))
            navigate(`/${lastPageData.lastPage.slug}`)
          } else {
            // No last page found, check if user has any pages
            api('/pages')
              .then((pagesData) => {
                if (pagesData?.pages && pagesData.pages.length > 0) {
                  // User has pages, navigate to the most recent one
                  const mostRecentPage = pagesData.pages[0]
                  const slug = mostRecentPage.slug || `${mostRecentPage.title.toLowerCase().replace(/\s+/g, '-')}-${mostRecentPage._id}`
                  navigate(`/${slug}`)
                } else {
                  // User has no pages, create a new one
                  console.log('User has no pages, creating new page...')
                  api('/pages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: 'Welcome to Pages' }),
                  })
                    .then((data) => {
                      console.log('New page created:', data)
                      return data
                    })
                    .then((newPageData) => {
                      if (newPageData?.slug) {
                        console.log('Navigating to new page:', newPageData.slug)
                        navigate(`/${newPageData.slug}`)
                      } else {
                        console.log('No slug in new page data, staying on home')
                      }
                    })
                     .catch((error) => {
                      console.error('Error creating new page:', error)
                      if (error instanceof ApiError && error.status === 429) {
                        const retryAfterMs = error.data?.error?.retryAfterMs ?? 60000
                        setBlocked(retryAfterMs)
                      }
                    })
                }
              })
              .catch(() => {})
          }
        })
        .catch(() => {})
    }
    
    if (!token) {
      console.log('No token found in App startup, attempting refresh...')
      fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(async (r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.accessToken) {
            console.log('Refresh successful on startup, setting token.')
            localStorage.setItem('accessToken', data.accessToken)
            setAccessToken(data.accessToken)
            // Fetch user data after successful refresh
            fetch(`${apiBase}/users/me`, {
              headers: { Authorization: `Bearer ${data.accessToken}` },
              credentials: 'include',
            })
              .then(async (r) => (r.ok ? r.json() : null))
              .then((userData) => {
                if (userData?.user) {
                  localStorage.setItem('user', JSON.stringify(userData.user))
                  setUser(userData.user)
                  
                  // Try to get last page from server
                  api('/users/last-page')
                    .then((lastPageData) => {
                      if (lastPageData?.lastPage?.slug) {
                        localStorage.setItem('lastPage', JSON.stringify(lastPageData.lastPage))
                        navigate(`/${lastPageData.lastPage.slug}`)
                      } else {
                        // No last page found, check if user has any pages
                        api('/pages')
                          .then((pagesData) => {
                            if (pagesData?.pages && pagesData.pages.length > 0) {
                              // User has pages, navigate to the most recent one
                              const mostRecentPage = pagesData.pages[0]
                              const slug = mostRecentPage.slug || `${mostRecentPage.title.toLowerCase().replace(/\s+/g, '-')}-${mostRecentPage._id}`
                              navigate(`/${slug}`)
                            } else {
                              // User has no pages, create a new one
                              console.log('User has no pages, creating new page...')
                                api('/pages', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ title: 'Welcome to Pages' }),
                                })
                                  .then((data) => {
                                    console.log('New page created:', data)
                                    return data
                                  })
                                .then((newPageData) => {
                                  if (newPageData?.slug) {
                                    console.log('Navigating to new page:', newPageData.slug)
                                    navigate(`/${newPageData.slug}`)
                                  } else {
                                    console.log('No slug in new page data, staying on home')
                                  }
                                })
                                .catch((error) => {
                                  console.error('Error creating new page:', error)
                                  if (error instanceof ApiError && error.status === 429) {
                                    const retryAfterMs = error.data?.error?.retryAfterMs ?? 60000
                                    setBlocked(retryAfterMs)
                                  }
                                })
                            }
                          })
                          .catch(() => {})
                      }
                    })
                    .catch(() => {})
                }
              })
              .catch(() => {})
          }
        })
        .catch(() => {})
    }
  }, [navigate])

  // Listen for auth changes (login/logout) and update state without page reload
  useEffect(() => {
    const onAuthUpdated = () => {
      const token = localStorage.getItem('accessToken')
      setAccessToken(token)
      const cachedUser = localStorage.getItem('user')
      if (cachedUser && cachedUser !== 'undefined' && cachedUser !== 'null') {
        try {
          setUser(JSON.parse(cachedUser))
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    }

    window.addEventListener('auth-updated', onAuthUpdated)
    return () => window.removeEventListener('auth-updated', onAuthUpdated)
  }, [])
  
  return (
    accessToken ? (
      <Layout header={<Header title={title} />} sidebar={<AppSidebar />}>
        <div className="h-full">
          <RateLimitBanner />
          <Editor title={title} onTitleChange={setTitle} />
        </div>
      </Layout>
    ) : (
      <AuthPage />
    )
  )
}

export default App
