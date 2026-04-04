import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { api, apiBase } from '@/lib/utils'
import { Layout } from '@/components/Layout'
import { Header } from '@/components/Header'
import { Skeleton } from '@/components/ui/skeleton'
import { AppSidebar } from '@/components/Sidebar'
import { Editor } from '@/components/Editor'
import type { Socket } from 'socket.io-client'
import { getSocket, updateSocketAuthToken } from '@/lib/socket'
import { setDocumentTitle, setFaviconFromIcon, setSocialMeta } from '@/lib/meta'
import { PasswordGate } from '@/components/PasswordGate'
import { RateLimitBanner } from '@/components/RateLimitBanner'
import { usePageCreationLimit } from '@/hooks/use-page-creation-limit'
import { ApiError } from '@/lib/utils'

export function PageRoute() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [title, setTitle] = useState('Untitled')
  const [pageId, setPageId] = useState<string | null>(null)
  const pageIdRef = useRef<string | null>(null)
  const [initialContent, setInitialContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isPublic, setIsPublic] = useState<boolean>(false)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [coverPosition, setCoverPosition] = useState<number>(50)
  const saveTimer = useRef<number | null>(null)
  const savingSequenceTimer = useRef<number | null>(null)
  const [icon, setIcon] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState<boolean>(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState<boolean>(false)
  const [showShareToast, setShowShareToast] = useState(false)
  const [ancestors, setAncestors] = useState<Array<{ _id: string; title: string; slug: string; icon?: string | null }>>([])
  const [locked, setLocked] = useState<boolean>(false)
  const socket: Socket | null = useMemo(() => getSocket(), [])
  const claimedRef = useRef(false)
  const [gateOpen, setGateOpen] = useState(false)
  const lockedPageIdRef = useRef<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const slugNavTimer = useRef<number | null>(null)
  const latestServerSlugRef = useRef<string | null>(null)
  const blocked = usePageCreationLimit((s) => s.blocked)
  const setBlocked = usePageCreationLimit((s) => s.setBlocked)

  // Debounced saving indicator: keep 'saving' during rapid edits, then show 'saved' and return to 'idle'
  function bumpSavingIndicator() {
    if (saving !== 'saving') setSaving('saving')
    if (savingSequenceTimer.current) window.clearTimeout(savingSequenceTimer.current)
    savingSequenceTimer.current = window.setTimeout(() => {
      setSaving('saved')
      window.setTimeout(() => setSaving('idle'), 1200)
    }, 800)
  }

  useEffect(() => {
    async function load() {
      if (!slug) return
      try {
        // extract token from slug suffix or query ?t=
        let token: string | null = null
        const dotIdx = slug.lastIndexOf('.')
        if (dotIdx > 0 && dotIdx < slug.length - 1) token = slug.slice(dotIdx + 1)
        const params = new URLSearchParams(location.search)
        if (!token && params.get('t')) token = String(params.get('t'))
        setShareToken(token)
        const path = `/pages/slug/${slug}` + (token ? `?t=${encodeURIComponent(token)}` : '')

        async function fetchWithUnlock(unlock?: string | null) {
          const accessToken = localStorage.getItem('accessToken')
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (accessToken) headers.Authorization = `Bearer ${accessToken}`
          if (unlock) headers['x-page-unlock'] = unlock
          const res = await fetch(`${apiBase}${path}`, { credentials: 'include', headers })
          return res
        }

        // try with any cached unlock token first (support both full slug and base slug without token suffix)
        let cachedUnlock: string | null = null
        const baseSlug = slug.includes('.') ? slug.split('.')[0] : slug
        try {
          cachedUnlock = sessionStorage.getItem(`unlock:${slug}`) || sessionStorage.getItem(`unlock-base:${baseSlug}`)
        } catch {}
        let resp = await fetchWithUnlock(cachedUnlock)
        if (resp.status === 401) {
          // Parse the body once and branch early on LOCKED to open the password gate without requiring login
          let body: any = {}
          try { body = await resp.clone().json() } catch {}
          if (body?.error?.code === 'LOCKED' && body?.error?.pageId) {
            lockedPageIdRef.current = String(body.error.pageId)
            setGateOpen(true)
            return
          }
          // If not a LOCKED error, a 401 may be due to expired owner auth. Try silent refresh once.
          try {
            const rr = await fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' })
            const data = rr.ok ? await rr.json() : null
            if (data?.accessToken) {
              localStorage.setItem('accessToken', data.accessToken)
              updateSocketAuthToken(data.accessToken)
              resp = await fetchWithUnlock(cachedUnlock)
            }
          } catch {}
        }
        if (!resp.ok) throw new Error(`Request failed: ${resp.status}`)
        const res = await resp.json() as { page: any; canEdit?: boolean; canView?: boolean; isOwner?: boolean }
        // Enforce local hideLocked preference: if enabled and page is locked, block viewing
        try {
          const hide = localStorage.getItem('hideLocked') === '1'
          if (hide && res?.page?.locked) {
            navigate('/home')
            return
          }
        } catch {}
        const newTitle = res.page?.title || 'Untitled'
        setTitle(newTitle)
        const id = res.page?._id || null
        setPageId(id)
        pageIdRef.current = id
        setInitialContent(res.page?.content || null)
        setIsPublic(!!res.page?.isPublic)
        setLocked(!!res.page?.locked)
        setCoverImageUrl(res.page?.coverImageUrl || null)
        setCoverPosition(typeof res.page?.coverPosition === 'number' ? res.page.coverPosition : 50)
        setIcon(res.page?.icon || null)
        setCanEdit(!!res.canEdit)
        setIsOwner(!!res.isOwner)
        // Load ancestors for breadcrumb
        if (id) {
          try {
            const ares = await api<{ ancestors: Array<{ _id: string; title: string; slug: string; icon?: string | null }> }>(`/pages/${id}/ancestors`)
            setAncestors(Array.isArray(ares.ancestors) ? ares.ancestors : [])
          } catch {
            setAncestors([])
          }
        } else {
          setAncestors([])
        }
        // Set metadata
        setDocumentTitle(newTitle)
        setFaviconFromIcon(res.page?.icon)
        setSocialMeta({
          title: newTitle,
          description: 'Pages',
          image: res.page?.coverImageUrl,
          url: window.location.href,
        })
        
        // Cache this page as the last accessed page
        if (id && slug) {
          const lastPageData = {
            id: id,
            title: res.page?.title || 'Untitled',
            slug: slug,
            updatedAt: res.page?.updatedAt,
          };
          localStorage.setItem('lastPage', JSON.stringify(lastPageData));
          // Maintain a recent-visited list (most recent first, unique by slug)
          try {
            const raw = localStorage.getItem('recentVisited')
            const arr: Array<{ slug: string; ts: number }> = raw ? JSON.parse(raw) : []
            const now = Date.now()
            const filtered = arr.filter((e) => e && e.slug !== slug)
            const next = [{ slug, ts: now, title: newTitle, icon: res.page?.icon || null }, ...filtered].slice(0, 30)
            localStorage.setItem('recentVisited', JSON.stringify(next))
          } catch {}
          // Persist to server
          try {
            await api('/users/recent-visited', {
              method: 'POST',
              body: JSON.stringify({ slug }),
            })
          } catch {}
        }
        
        if (socket && id) socket.emit('page.join', { pageId: id, token })
      } catch {
        // If page load fails (e.g., 404 or forbidden), clear stale lastPage and fallback to home
        try { localStorage.removeItem('lastPage') } catch {}
        navigate('/')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug, navigate, socket, location.search, reloadNonce])

  async function handleGateSubmit(password: string) {
    const pid = lockedPageIdRef.current
    if (!pid || !slug) return
    const verifyRes = await fetch(`${apiBase}/pages/${pid}/verify-lock`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!verifyRes.ok) throw new Error('Invalid password')
    const vjson = await verifyRes.json()
    const unlockToken: string | null = vjson?.unlock || null
    if (unlockToken) {
      try {
        const baseSlug = slug.includes('.') ? slug.split('.')[0] : slug
        sessionStorage.setItem(`unlock:${slug}`, unlockToken)
        sessionStorage.setItem(`unlock-base:${baseSlug}`, unlockToken)
      } catch {}
    }
    setGateOpen(false)
    setReloadNonce((n) => n + 1)
  }

  useEffect(() => {
    if (!socket) return
    socket.on('connect', () => {
      const id = pageIdRef.current
      if (id) socket.emit('page.join', { pageId: id, token: shareToken })
    })
    socket.on('connect_error', (err) => {
      console.error('socket connect_error', err.message)
      // If unauthorized, try refresh and reconnect with new token
      if (err.message?.toLowerCase().includes('unauthorized')) {
        fetch(`${(import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000/api'}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
          .then(async (r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.accessToken) {
              localStorage.setItem('accessToken', data.accessToken)
              updateSocketAuthToken(data.accessToken)
              socket.connect()
            }
          })
          .catch(() => {})
      }
    })
    const onUpdated = (payload: any) => {
      if (payload.title !== undefined) setTitle(payload.title)
      if (payload.coverImageUrl !== undefined) setCoverImageUrl(payload.coverImageUrl)
      if (payload.coverPosition !== undefined) setCoverPosition(payload.coverPosition)
      if (payload.icon !== undefined) setIcon(payload.icon)
      // For collaborative: could also update editor content here
    }
    socket.on('page.updated', onUpdated)
    const onSubpageMeta = (payload: { pageId: string; title?: string; icon?: string | null }) => {
      try {
        window.dispatchEvent(new CustomEvent('subpage-meta', { detail: payload }))
      } catch {}
    }
    socket.on('subpage.meta', onSubpageMeta)
    const onSubpageDeleted = (payload: { pageId: string }) => {
      try {
        window.dispatchEvent(new CustomEvent('subpage-deleted', { detail: payload }))
      } catch {}
    }
    socket.on('subpage.deleted', onSubpageDeleted)
    return () => {
      socket.off('page.updated', onUpdated)
      socket.off('subpage.meta', onSubpageMeta)
      socket.off('subpage.deleted', onSubpageDeleted)
      // do not close singleton socket; only remove listeners
    }
  }, [socket])

  // Cleanup any pending navigation timer on unmount
  useEffect(() => {
    return () => {
      if (slugNavTimer.current) window.clearTimeout(slugNavTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!isOwner && canEdit) {
      setShowShareToast(true)
      const t = window.setTimeout(() => setShowShareToast(false), 3500)
      return () => window.clearTimeout(t)
    }
  }, [isOwner, canEdit])

  // Claim the link once when user can edit via token
  useEffect(() => {
    async function claim() {
      if (claimedRef.current) return
      if (!pageId || !canEdit || !shareToken) return
      try {
        await api(`/pages/${pageId}/claim-link`, {
          method: 'POST',
          body: JSON.stringify({ token: shareToken }),
        })
        claimedRef.current = true
        try { window.dispatchEvent(new Event('shared-links-updated')) } catch {}
      } catch {}
    }
    claim()
  }, [pageId, canEdit, shareToken])

  if (loading) {
    return (
      <Layout
        header={
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 pl-3 sm:pl-4 w-full">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        }
        sidebar={<AppSidebar />}
      >
        <div className="px-4 pb-8">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-center gap-2 my-4">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-10 w-48" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={`line-${i}`} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout header={<Header title={title} savingState={saving} pageId={pageId} slug={slug || null} isPublic={isPublic} onPrivacyChanged={setIsPublic} ancestors={ancestors} locked={locked} onLockChanged={setLocked} />} sidebar={<AppSidebar />}> 
      <div className="h-full">
        {showShareToast ? (
          <div className="fixed bottom-4 right-4 z-50 rounded-md border text-sm px-3 py-2 shadow
            bg-amber-50 text-amber-900 border-amber-200
            dark:bg-amber-900/80 dark:text-amber-50 dark:border-amber-800">
            You are editing via a share link. Your changes will be saved to this page.
          </div>
        ) : null}
        <RateLimitBanner />
        <Editor key={pageId}
          title={title}
          initialContentJSON={initialContent}
          readOnly={!canEdit}
          coverImageUrl={coverImageUrl}
          coverPosition={coverPosition}
          icon={icon}
          persistKey={pageId || slug || 'page'}
          onCreateSubpage={async (t: string) => {
            if (!pageId) throw new Error('No pageId')
            if (blocked) throw new Error('Action blocked by rate limit')
            try {
              const res = await api<{ page: any; slug: string }>(`/pages/${pageId}/subpages`, {
                method: 'POST',
                body: JSON.stringify({ title: t }),
              })
              return { id: res.page?._id, slug: res.slug || '', title: res.page?.title || 'Untitled', icon: res.page?.icon || null }
            } catch (error) {
              if (error instanceof ApiError && error.status === 429) {
                const retryAfterMs = error.data?.error?.retryAfterMs ?? 60000
                setBlocked(retryAfterMs)
              }
              throw error
            }
          }}
          onIconChange={(v: string | null) => {
            setIcon(v)
            if (!pageId || !socket || !canEdit) return
            if (saveTimer.current) window.clearTimeout(saveTimer.current)
            saveTimer.current = window.setTimeout(() => {
              bumpSavingIndicator()
              socket.emit('page.edit', { pageId, icon: v === null ? null : v })
            }, 300)
          }}
          onCoverImageUrlChange={(url) => {
            setCoverImageUrl(url)
            if (!pageId || !socket || !canEdit) return
            if (saveTimer.current) window.clearTimeout(saveTimer.current)
            saveTimer.current = window.setTimeout(() => {
              bumpSavingIndicator()
              socket.emit('page.edit', { pageId, coverImageUrl: url === null ? null : url })
            }, 400)
          }}
          onCoverPositionChange={(pos) => {
            setCoverPosition(pos)
            if (!pageId || !socket || !canEdit) return
            if (saveTimer.current) window.clearTimeout(saveTimer.current)
            saveTimer.current = window.setTimeout(() => {
              bumpSavingIndicator()
              socket.emit('page.edit', { pageId, coverPosition: pos })
            }, 300)
          }}
          onTitleChange={(t) => {
            setTitle(t)
            setDocumentTitle(t || 'Untitled')
            if (socket && pageId && canEdit) {
              bumpSavingIndicator()
              socket.emit('page.edit', { pageId, title: t })
            }
            // Also persist via REST to sync slug and navigate if changed
            if (!pageId) return
            if (saveTimer.current) window.clearTimeout(saveTimer.current)
            saveTimer.current = window.setTimeout(async () => {
              try {
                const res = await api<{ page: any; slug: string }>(`/pages/${pageId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ title: t })
                })
                const newSlug = res?.slug
                const currentSlug = slug || ''
                if (newSlug && newSlug !== currentSlug) {
                  latestServerSlugRef.current = newSlug
                  if (slugNavTimer.current) window.clearTimeout(slugNavTimer.current)
                  slugNavTimer.current = window.setTimeout(() => {
                    const target = latestServerSlugRef.current
                    if (target && target !== (slug || '')) {
                      const qs = location.search || ''
                      try {
                        window.history.replaceState(null, '', `/${target}${qs}`)
                      } catch {}
                    }
                  }, 600)
                }
              } catch {}
            }, 400)
          }} onContentChange={(json) => {
          if (socket && pageId && canEdit) {
            bumpSavingIndicator()
            socket.emit('page.edit', { pageId, content: json })
          }
        }} />
        {gateOpen ? (
          <PasswordGate onSubmit={handleGateSubmit} />
        ) : null}
      </div>
    </Layout>
  )
}


