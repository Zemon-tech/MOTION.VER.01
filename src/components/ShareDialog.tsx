import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/utils'
// Lightweight local tab state; no external UI deps

type ShareDialogProps = {
  pageId: string
  slug: string
  isPublic: boolean
  onPrivacyChanged?: (isPublic: boolean) => void
  trigger: React.ReactNode
}

export function ShareDialog({ pageId, slug, isPublic, onPrivacyChanged, trigger }: ShareDialogProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [currentPublic, setCurrentPublic] = useState(isPublic)
  const [token, setToken] = useState<string | null>(null)
  const [allowEdit, setAllowEdit] = useState<boolean>(false)
  const [expiresAt, setExpiresAt] = useState<string | ''>('')
  const [collabs, setCollabs] = useState<Array<{ _id: string; email: string; name?: string; role?: 'viewer'|'editor' }>>([])
  const [owner, setOwner] = useState<{ _id: string; email: string; name?: string } | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [activeTab, setActiveTab] = useState<'share' | 'publish'>('share')
  const [showLinkSettings, setShowLinkSettings] = useState(false)
  const [locked, setLocked] = useState<boolean>(false)
  const [lockPassword, setLockPassword] = useState<string>('')
  const shareUrl = useMemo(() => {
    return token ? `${window.location.origin}/s/${slug}.${token}` : `${window.location.origin}/s/${slug}`
  }, [slug, token])

  // Load current token when dialog opens (owner-only endpoint)
  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const res = await api<{ page: any }>(`/pages/${pageId}`)
        setToken(res?.page?.shareToken || null)
        setCurrentPublic(!!res?.page?.isPublic)
        setAllowEdit(!!res?.page?.linkEditEnabled)
        setLocked(!!res?.page?.locked)
        const exp = res?.page?.linkExpiresAt
        if (exp) {
          try {
            // Convert to local datetime-local input value (YYYY-MM-DDTHH:mm)
            const d = new Date(exp)
            const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16)
            setExpiresAt(iso)
          } catch {
            setExpiresAt('')
          }
        } else {
          setExpiresAt('')
        }
        // Load collaborators
        try {
          const c = await api<{ owner: any; collaborators: any[] }>(`/pages/${pageId}/collaborators`)
          setOwner(c.owner || null)
          setCollabs(Array.isArray(c.collaborators) ? c.collaborators as any : [])
        } catch {}
      } catch {}
    })()
  }, [open, pageId])

  async function togglePublic(next: boolean) {
    setBusy(true)
    try {
      const res = await api<{ page: any; slug: string }>(`/pages/${pageId}/privacy`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: next }),
      })
      setCurrentPublic(next)
      setToken(res?.page?.shareToken || null)
      onPrivacyChanged?.(next)
      try { window.dispatchEvent(new Event('shared-links-updated')) } catch {}
    } catch (e) {
      // no-op
    } finally {
      setBusy(false)
    }
  }

  async function setAllowEditing(next: boolean) {
    setBusy(true)
    try {
      await api<{ page: any; slug: string }>(`/pages/${pageId}/privacy`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: true, linkEditEnabled: next }),
      })
      setAllowEdit(next)
      try { window.dispatchEvent(new Event('shared-links-updated')) } catch {}
    } catch {}
    setBusy(false)
  }

  async function saveExpiry(next: string | '') {
    setBusy(true)
    try {
      const payload: any = { isPublic: true }
      if (next) {
        // Convert local datetime-local back to UTC ISO string
        const local = new Date(next)
        const iso = new Date(local.getTime() + local.getTimezoneOffset() * 60000).toISOString()
        payload.linkExpiresAt = iso
      } else {
        payload.linkExpiresAt = null
      }
      await api<{ page: any; slug: string }>(`/pages/${pageId}/privacy`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setExpiresAt(next)
    } catch {}
    setBusy(false)
  }

  async function rotate() {
    setBusy(true)
    try {
      const res = await api<{ page: any; slug: string }>(`/pages/${pageId}/privacy`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: true, rotateToken: true }),
      })
      setToken(res?.page?.shareToken || null)
    } catch {}
    setBusy(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).catch(() => {})
  }

  function presetExpiry(hoursFromNow: number | null) {
    if (hoursFromNow === null) {
      saveExpiry('')
      return
    }
    const now = new Date()
    const when = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000)
    // Convert to local input string format used internally
    const isoLocal = new Date(when.getTime() - when.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setExpiresAt(isoLocal)
    // Persist as UTC ISO
    saveExpiry(isoLocal)
  }

  async function toggleLock(nextLocked: boolean) {
    setBusy(true)
    try {
      const payload: any = { locked: nextLocked }
      if (nextLocked && lockPassword) payload.password = lockPassword
      const res = await api<{ ok: boolean; page: { _id: string; locked: boolean } }>(`/pages/${pageId}/lock`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setLocked(!!res?.page?.locked)
      if (nextLocked) setLockPassword('')
    } catch {}
    setBusy(false)
  }

  async function invite() {
    if (!inviteEmail) return
    setBusy(true)
    try {
      await api(`/pages/${pageId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      })
      setInviteEmail('')
      const c = await api<{ owner: any; collaborators: any[] }>(`/pages/${pageId}/collaborators`)
      setOwner(c.owner || null)
      setCollabs(Array.isArray(c.collaborators) ? c.collaborators as any : [])
    } catch {}
    setBusy(false)
  }

  async function removeCollaborator(userId: string) {
    setBusy(true)
    try {
      await api(`/pages/${pageId}/collaborators/${userId}`, { method: 'DELETE' })
      const c = await api<{ owner: any; collaborators: any[] }>(`/pages/${pageId}/collaborators`)
      setOwner(c.owner || null)
      setCollabs(Array.isArray(c.collaborators) ? c.collaborators as any : [])
    } catch {}
    setBusy(false)
  }

  async function changeRole(userId: string, role: 'viewer'|'editor') {
    setBusy(true)
    try {
      await api(`/pages/${pageId}/collaborators/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) })
      const c = await api<{ owner: any; collaborators: any[] }>(`/pages/${pageId}/collaborators`)
      setOwner(c.owner || null)
      setCollabs(Array.isArray(c.collaborators) ? c.collaborators as any : [])
      try { window.dispatchEvent(new Event('shared-links-updated')) } catch {}
    } catch {}
    setBusy(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
        </DialogHeader>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <button className={`text-sm py-1.5 rounded border ${activeTab==='share'?'border-foreground':'border-border'}`} onClick={()=>setActiveTab('share')}>Share</button>
            <button className={`text-sm py-1.5 rounded border ${activeTab==='publish'?'border-foreground':'border-border'}`} onClick={()=>setActiveTab('publish')}>Publish</button>
          </div>

          {activeTab === 'share' ? (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <input
                  placeholder="Email or group"
                  className="flex-1 border rounded px-2 py-1 text-sm bg-background"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') invite() }}
                />
                <Button disabled={busy || !inviteEmail} onClick={invite}>Invite</Button>
              </div>
              <div className="space-y-2">
                {owner ? (
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{owner.name || owner.email}</div>
                      <div className="text-xs text-muted-foreground">Owner</div>
                    </div>
                    <span className="text-xs text-muted-foreground">Full access</span>
                  </div>
                ) : null}
                {collabs.map((u) => (
                  <div key={u._id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{u.name || u.email}</div>
                      <div className="text-xs text-muted-foreground">Collaborator</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="border rounded px-1.5 py-1 text-xs bg-background"
                        disabled={busy}
                        value={u.role || 'editor'}
                        onChange={(e) => changeRole(u._id, e.target.value as 'viewer'|'editor')}
                      >
                        <option value="editor">Can edit</option>
                        <option value="viewer">Can view</option>
                      </select>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => removeCollaborator(u._id)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">General access</div>
                  <div className="text-xs text-muted-foreground">Only invited or anyone with the link</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={currentPublic ? 'outline' : 'default'} disabled={busy} onClick={() => togglePublic(false)}>Only invited</Button>
                  <Button variant={currentPublic ? 'default' : 'outline'} disabled={busy} onClick={() => togglePublic(true)}>Anyone with link</Button>
                  {currentPublic ? (
                    <Button variant="outline" onClick={copyLink}>Copy link</Button>
                  ) : null}
                </div>
              </div>
              {currentPublic ? (
                <div className="space-y-2">
                  <button
                    className="text-xs text-muted-foreground underline"
                    onClick={() => setShowLinkSettings((v) => !v)}
                  >
                    {showLinkSettings ? 'Hide link settings' : 'Show link settings'}
                  </button>
                  {showLinkSettings ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">Allow editing</div>
                          <div className="text-xs text-muted-foreground">Editors must be logged in</div>
                        </div>
                        <Button variant={allowEdit ? 'default' : 'outline'} disabled={busy} onClick={() => setAllowEditing(!allowEdit)}>
                          {allowEdit ? 'Enabled' : 'Enable'}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Link expiry</div>
                        <div className="text-xs text-muted-foreground">
                          Current: {expiresAt ? new Date(expiresAt).toLocaleString() : 'Never'}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" disabled={busy} onClick={() => presetExpiry(1)}>In an hour</Button>
                          <Button variant="outline" disabled={busy} onClick={() => presetExpiry(24)}>In a day</Button>
                          <Button variant="outline" disabled={busy} onClick={() => presetExpiry(null)}>Never</Button>
                          <Button variant="outline" disabled={busy} onClick={rotate}>Rotate link</Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Password lock</div>
                        <div className="text-xs text-muted-foreground">Require a password to view for non-collaborators</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder={locked ? 'Locked' : 'Set password'}
                            className="flex-1 border rounded px-2 py-1 text-sm bg-background"
                            value={lockPassword}
                            onChange={(e) => setLockPassword(e.target.value)}
                            disabled={busy || locked}
                          />
                          {locked ? (
                            <Button variant="outline" disabled={busy} onClick={() => toggleLock(false)}>Unlock</Button>
                          ) : (
                            <Button variant="outline" disabled={busy || !lockPassword} onClick={() => toggleLock(true)}>Lock</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'publish' ? (
            <div className="space-y-4 mt-4">
              <div className="space-y-1">
                <div className="text-base font-semibold">Publish to web</div>
                <div className="text-xs text-muted-foreground">Create a public link to this page</div>
              </div>
              <div className="rounded-md border bg-muted/30 aspect-[16/9] flex items-center justify-center text-xs text-muted-foreground">
                Page preview
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">Status</div>
                <Button variant={currentPublic ? 'default' : 'outline'} disabled={busy} onClick={() => togglePublic(!currentPublic)}>
                  {currentPublic ? 'Public' : 'Publish'}
                </Button>
              </div>
              {currentPublic ? (
                <div className="flex items-center justify-between">
                  <div className="text-sm">Link</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={copyLink}>Copy link</Button>
                    <Button variant="outline" disabled={busy} onClick={rotate}>Rotate</Button>
                  </div>
                </div>
              ) : null}
              {currentPublic ? (
                <Button variant="outline" disabled={busy} onClick={() => togglePublic(false)}>
                  Stop sharing
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
