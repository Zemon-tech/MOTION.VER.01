import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { apiBase } from '@/lib/utils'
import { Layout } from '@/components/Layout'
import { ShareHeader } from '@/components/ShareHeader'
import { Editor } from '@/components/Editor'
import { setDocumentTitle, setFaviconFromIcon, setSocialMeta } from '@/lib/meta'
import type { Socket } from 'socket.io-client'
import { getSocket, updateSocketAuthToken } from '@/lib/socket'
import { PasswordGate } from '@/components/PasswordGate'

export function ShareRoute() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [title, setTitle] = useState('Untitled')
  const [pageId, setPageId] = useState<string | null>(null)
  const pageIdRef = useRef<string | null>(null)
  const [initialContent, setInitialContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [coverPosition, setCoverPosition] = useState<number>(50)
  const [icon, setIcon] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState<boolean>(false)
  const [isOwner, setIsOwner] = useState<boolean>(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const savingSequenceTimer = useRef<number | null>(null)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const socket: Socket | null = useMemo(() => getSocket(), [])
  const [gateOpen, setGateOpen] = useState(false)
  const lockedPageIdRef = useRef<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [ancestors, setAncestors] = useState<Array<{ _id: string; title: string; slug: string; icon?: string | null }>>([])

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
        // extract share token from slug suffix or ?t=
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

        let cachedUnlock: string | null = null
        const baseSlug = slug.includes('.') ? slug.split('.')[0] : slug
        try { cachedUnlock = sessionStorage.getItem(`unlock:${slug}`) || sessionStorage.getItem(`unlock-base:${baseSlug}`) } catch {}
        let resp = await fetchWithUnlock(cachedUnlock)
        if (resp.status === 401) {
          // Parse once and if LOCKED, open password gate immediately (no login required)
          let body: any = {}
          try { body = await resp.clone().json() } catch {}
          if (body?.error?.code === 'LOCKED' && body?.error?.pageId) {
            lockedPageIdRef.current = String(body.error.pageId)
            setGateOpen(true)
            return
          }
          // Otherwise, try silent refresh in case the viewer is actually the owner with expired auth
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
        if (!res?.page?.isPublic && !res.canView) {
          navigate('/')
          return
        }
        const t = res.page?.title || 'Untitled'
        setTitle(t)
        const id = res.page?._id || null
        setPageId(id)
        pageIdRef.current = id
        setInitialContent(res.page?.content || null)
        setCoverImageUrl(res.page?.coverImageUrl || null)
        setCoverPosition(typeof res.page?.coverPosition === 'number' ? res.page.coverPosition : 50)
        setIcon(res.page?.icon || null)
        const editable = !!res.canEdit
        setCanEdit(editable)
        setIsOwner(!!res.isOwner)
        // Metadata
        setDocumentTitle(t)
        setFaviconFromIcon(res.page?.icon)
        setSocialMeta({
          title: t,
          description: 'Shared with Pages',
          image: res.page?.coverImageUrl,
          url: window.location.href,
        })
        if (socket && id) socket.emit('page.join', { pageId: id, token })
        // Load ancestors for breadcrumb
        if (id) {
          try {
            const ares = await fetch(`${apiBase}/pages/${id}/ancestors`, { credentials: 'include' })
            const aj = ares.ok ? await ares.json() : { ancestors: [] }
            setAncestors(Array.isArray(aj.ancestors) ? aj.ancestors : [])
          } catch {
            setAncestors([])
          }
        } else {
          setAncestors([])
        }
        // Only redirect owners to the main app UI.
        // Viewers/editors via shared link should remain under /s to preserve share context across subpages.
        if (res.isOwner === true) {
          const qs = location.search || ''
          navigate(`/${slug}${qs}`)
          return
        }
      } catch {
        navigate('/')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug, navigate, location.search, socket, reloadNonce])

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
      if (err.message?.toLowerCase().includes('unauthorized')) {
        fetch(`${apiBase}/auth/refresh`, {
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
    }
    socket.on('page.updated', onUpdated)
    return () => {
      socket.off('page.updated', onUpdated)
    }
  }, [socket, shareToken])

  if (loading) return null

  return (
    <Layout header={<ShareHeader title={title} ancestors={ancestors} />} sidebar={null as any} hideSidebar>
      <div className="h-full">
        {!isOwner && canEdit ? (
          <div className="px-4 pt-2">
            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-2 rounded-md border bg-amber-50 text-amber-900 text-sm px-3 py-2">
                You are editing via a share link. Your changes will be saved to this page.
              </div>
            </div>
          </div>
        ) : null}
        <Editor
          key={pageId}
          title={title}
          onTitleChange={(t) => {
            setTitle(t)
            if (socket && pageId && canEdit) {
              bumpSavingIndicator()
              socket.emit('page.edit', { pageId, title: t })
            }
          }}
          initialContentJSON={initialContent}
          readOnly={!canEdit}
          coverImageUrl={coverImageUrl}
          coverPosition={coverPosition}
          icon={icon}
          onCoverImageUrlChange={(url) => {
            setCoverImageUrl(url)
            if (socket && pageId && canEdit) {
              bumpSavingIndicator()
              socket.emit('page.edit', { pageId, coverImageUrl: url === null ? null : url })
            }
          }}
          onCoverPositionChange={(pos) => {
            setCoverPosition(pos)
            if (socket && pageId && canEdit) {
              bumpSavingIndicator()
              socket.emit('page.edit', { pageId, coverPosition: pos })
            }
          }}
          onContentChange={(json) => {
            if (socket && pageId && canEdit) {
              bumpSavingIndicator()
              socket.emit('page.edit', { pageId, content: json })
            }
          }}
          persistKey={pageId || slug || 'share'}
        />
        {gateOpen ? (
          <PasswordGate onSubmit={handleGateSubmit} />
        ) : null}
        {gateOpen ? (
          <div className="fixed top-4 left-4 z-[110] inline-flex items-center gap-2">
            <img src="/motion.svg" alt="Logo" className="h-6 w-6 brightness-0 invert" />
            <span className="text-sm font-bold text-white">Motion</span>
          </div>
        ) : null}
      </div>
    </Layout>
  )
}
