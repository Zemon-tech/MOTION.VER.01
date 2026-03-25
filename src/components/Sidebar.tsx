import { Calendar, Home, Inbox, Search, Settings, User2, MoreHorizontal, SquarePen, FileText, ChevronRight, ChevronDown } from 'lucide-react'
import { Lock } from 'lucide-react'
import {
  Sidebar as ShadSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { SidebarFooter } from '@/components/ui/sidebar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SettingsDialog } from '@/components/SettingsDialog'
import { Skeleton } from '@/components/ui/skeleton'

const items = [
  { title: 'Home', icon: Home },
  { title: 'Inbox', icon: Inbox },
  { title: 'Calendar', icon: Calendar },
  { title: 'Search', icon: Search },
  { title: 'Settings', icon: Settings },
]

type PageItem = { _id: string; title: string; slug: string; icon?: string | null; parentId?: string | null; locked?: boolean }
type PageNode = PageItem & { children: PageNode[] }

function buildTree(items: PageItem[]): PageNode[] {
  const map = new Map<string, PageNode>()
  const roots: PageNode[] = []
  for (const p of items) map.set(p._id, { ...p, children: [] })
  for (const p of items) {
    const node = map.get(p._id)!
    if (p.parentId && map.has(p.parentId)) map.get(p.parentId)!.children.push(node)
    else roots.push(node)
  }
  const sortNodes = (arr: PageNode[]) => {
    arr.sort((a, b) => a.title.localeCompare(b.title))
    arr.forEach((n) => sortNodes(n.children))
  }
  sortNodes(roots)
  return roots
}

function TreeRow({ node, depth, expanded, setExpanded, onDelete }: { node: PageNode; depth: number; expanded: Record<string, boolean>; setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; onDelete: (id: string) => void }) {
  const hasChildren = node.children && node.children.length > 0
  const isOpen = !!expanded[node._id]
  return (
    <>
      <SidebarMenuItem className="group/row flex items-center">
        <div className="relative flex items-center w-full px-1 rounded-md hover:bg-accent/60">
          <div className="mr-2 w-4 shrink-0 flex items-center justify-center">
            {node.icon ? (
              <span className="inline-flex items-center justify-center h-4 text-base leading-none group-hover/row:hidden">
                {node.icon}
              </span>
            ) : (
              <FileText className="group-hover/row:hidden" />
            )}
            <button
              type="button"
              aria-label={isOpen ? 'Collapse' : 'Expand'}
              className="hidden group-hover/row:inline-flex p-0.5 rounded hover:bg-muted"
              onClick={() => setExpanded((prev) => ({ ...prev, [node._id]: !prev[node._id] }))}
            >
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          </div>

          <SidebarMenuButton asChild>
            <Link to={`/${node.slug}`} className="flex-1 inline-flex items-center min-w-0">
              <span className="truncate">{node.title}</span>
            </Link>
          </SidebarMenuButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-auto mr-1 p-1 rounded hover:bg-muted opacity-0 group-hover/row:opacity-100 transition-opacity"
                aria-label="Page options"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDelete(node._id)}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarMenuItem>
      {isOpen ? (
        hasChildren ? (
          <div className="ml-5">
            {node.children.map((child: PageNode) => (
              <TreeRow key={child._id} node={child} depth={depth + 1} expanded={expanded} setExpanded={setExpanded} onDelete={onDelete} />
            ))}
          </div>
        ) : (
          <div className="ml-5 pl-2 py-1 text-xs text-muted-foreground">No pages inside</div>
        )
      ) : null}
    </>
  )
}
type SharedLinkItem = { pageId: string; slug: string; token?: string | null; title: string; addedAt: string; ownerId?: string; ownerName?: string; icon?: string | null }
type OwnerSharedItem = { _id: string; title: string; slug: string; updatedAt?: string }

export function AppSidebar() {
  const { state } = useSidebar()
  const [pages, setPages] = useState<PageItem[]>([])
  const [loadingPages, setLoadingPages] = useState<boolean>(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [shared, setShared] = useState<SharedLinkItem[]>([])
  const [sharedByMe, setSharedByMe] = useState<OwnerSharedItem[]>([])
  const [username, setUsername] = useState<string>('')
  const [hideLocked, setHideLocked] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('hideLocked')
      // Default to hiding locked pages when not previously set
      return v == null ? true : v === '1'
    } catch { return true }
  })
  const navigate = useNavigate()

  async function refreshPages() {
    try {
      setLoadingPages(true)
      console.log('Refreshing pages...')
      const token = localStorage.getItem('accessToken')
      console.log('Token present:', !!token)
      
      const data = await api('/pages')
      console.log('Pages data:', data)
      // Expect backend to include parentId for hierarchy
      setPages((data.pages || []).map((p: any) => ({ _id: p._id, title: p.title, slug: p.slug, icon: p.icon || null, parentId: p.parentId || null, locked: !!p.locked })))
      console.log('Pages set:', data.pages?.length || 0)
    } catch (error) {
      console.error('Error fetching pages:', error)
    }
    setLoadingPages(false)
  }

  async function refreshShared() {
    try {
      const data = await api('/pages/shared')
      const arr: SharedLinkItem[] = Array.isArray((data as any).shared) ? (data as any).shared : []
      // sort by addedAt desc
      arr.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
      setShared(arr)
    } catch (error) {
      // ignore
    }
  }

  async function refreshSharedByMe() {
    try {
      const data = await api('/pages/shared-by-me')
      const arr: OwnerSharedItem[] = Array.isArray((data as any).pages) ? (data as any).pages : []
      setSharedByMe(arr)
    } catch {}
  }

  async function clearAllShared() {
    try {
      await api('/users/clear-shared', { method: 'POST' })
    } catch {}
    await Promise.all([refreshShared(), refreshSharedByMe()])
    try { window.dispatchEvent(new Event('shared-links-updated')) } catch {}
  }

  async function refreshUser() {
    try {
      // Try localStorage first for instant display
      const cachedUser = localStorage.getItem('user')
      if (cachedUser && cachedUser !== 'undefined' && cachedUser !== 'null') {
        try {
          const user = JSON.parse(cachedUser)
          setUsername(user?.name || user?.email || 'User')
        } catch (e) {
          console.error('Error parsing cached user in sidebar:', e)
          // Clear invalid data
          localStorage.removeItem('user')
        }
      }
      
      // Then fetch fresh data from API
      const data = await api('/users/me')
      const user = data.user
      setUsername(user?.name || user?.email || 'User')
      // Update localStorage with fresh data
      localStorage.setItem('user', JSON.stringify(user))
    } catch (error) {
      console.error('Error fetching user:', error)
    }
  }

  useEffect(() => {
    refreshPages()
    refreshShared()
    refreshSharedByMe()
    refreshUser()
    const onShared = () => { Promise.all([refreshShared(), refreshSharedByMe()]).catch(() => {}) }
    window.addEventListener('shared-links-updated', onShared)
    return () => window.removeEventListener('shared-links-updated', onShared)
  }, [])

  async function createPage() {
    try {
      console.log('Creating new page from sidebar...')
      const token = localStorage.getItem('accessToken')
      console.log('Token present for create:', !!token)
      
      const data = await api('/pages', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Page' }),
      })
      
      console.log('New page created:', data)
      await refreshPages()
      if (data.slug) {
        console.log('Navigating to new page:', data.slug)
        navigate(`/${data.slug}`)
      }
    } catch (error) {
      console.error('Error creating page:', error)
    }
  }

  async function deletePage(pageId: string) {
    try {
      await api(`/pages/${pageId}`, {
        method: 'DELETE',
      })
      await refreshPages()
      // Decide where to go next without triggering app-wide redirects
      try {
        const data = await api('/pages')
        const remaining = Array.isArray((data as any).pages) ? (data as any).pages : []
        if (remaining.length > 0) {
          const next = remaining[0]
          const slug = next.slug || `${next.title?.toLowerCase?.().replace(/\s+/g, '-')}-${next._id}`
          localStorage.setItem('lastPage', JSON.stringify({ id: next._id, title: next.title, slug, updatedAt: next.updatedAt }))
          navigate(`/${slug}`)
        } else {
          localStorage.removeItem('lastPage')
          navigate('/home')
        }
      } catch {
        navigate('/home')
      }
    } catch (error) {
      console.error('Error deleting page:', error)
    }
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {}
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    localStorage.removeItem('lastPage')
    window.dispatchEvent(new Event('auth-updated'))
    navigate('/')
  }
  return (
    <ShadSidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 group/header">
          <span className="text-sm font-medium">Motion</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title={hideLocked ? 'Show locked pages' : 'Hide locked pages'}
              onClick={() => { const next = !hideLocked; setHideLocked(next); try { localStorage.setItem('hideLocked', next ? '1' : '0'); window.dispatchEvent(new Event('hideLocked-changed')) } catch {} }}
              className={`h-6 w-6 inline-flex items-center justify-center rounded border text-xs transition-opacity ${hideLocked ? 'bg-foreground text-background' : 'bg-background'} opacity-0 group-hover/header:opacity-100`}
            >
              <Lock className="size-3" />
            </button>
            <Button variant="outline" size="icon" className="h-6 w-6" onClick={createPage} title="Create page">
              <SquarePen className="size-3" />
            </Button>
            {state === 'expanded' ? <SidebarTrigger /> : null}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.title === 'Settings' ? (
                    <SettingsDialog
                      trigger={
                        <SidebarMenuButton asChild>
                          <button type="button">
                            <Settings />
                            <span>Settings</span>
                          </button>
                        </SidebarMenuButton>
                      }
                    />
                  ) : item.title === 'Home' ? (
                    <SidebarMenuButton asChild>
                      <Link to="/home">
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild>
                      <button type="button">
                        <item.icon />
                        <span>{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <Separator className="my-2" />
        <SidebarGroup>
          <SidebarGroupLabel>Pages</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loadingPages ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <SidebarMenuItem key={`sk-${i}`}>
                    <div className="flex items-center w-full gap-2 px-2 py-1">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  </SidebarMenuItem>
                ))
              ) : (
                buildTree(pages.filter((p) => !p.locked)).map((node: PageNode) => (
                  <TreeRow key={node._id} node={node} depth={0} expanded={expanded} setExpanded={setExpanded} onDelete={deletePage} />
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {!hideLocked && pages.some((p) => p.locked) ? (
          <SidebarGroup>
            <SidebarGroupLabel>Private Pages</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {buildTree(pages.filter((p) => !!p.locked)).map((node: PageNode) => (
                  <TreeRow key={node._id} node={node} depth={0} expanded={expanded} setExpanded={setExpanded} onDelete={deletePage} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        {sharedByMe.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Shared by you</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sharedByMe.map((p) => (
                  <SidebarMenuItem key={`me:${p._id}`} className="group flex items-center">
                    <SidebarMenuButton asChild>
                      <Link to={`/${p.slug}`} className="flex-1">
                        <FileText />
                        <span>{p.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {shared.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Shared with you</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 pb-2">
                <Button variant="outline" size="sm" onClick={clearAllShared}>Clear shared pages</Button>
              </div>
              {/* Group by ownerName */}
              {Object.entries(shared.reduce((acc: Record<string, SharedLinkItem[]>, item) => {
                const key = item.ownerName || 'Shared'
                ;(acc[key] ||= []).push(item)
                return acc
              }, {})).map(([owner, items]) => (
                <div key={owner} className="mb-2">
                  <div className="px-2 pb-1 text-xs text-muted-foreground">{owner}</div>
                  <SidebarMenu>
                    {items.map((s) => (
                      <SidebarMenuItem key={`${s.pageId}:${s.token}`} className="group flex items-center">
                        <SidebarMenuButton asChild>
                          <Link to={`/${s.slug}${s.token ? `?t=${encodeURIComponent(s.token)}` : ''}`} className="flex-1">
                            {s.icon ? (
                              <span className="inline-flex items-center justify-center w-4 h-4 text-base leading-none">
                                {s.icon}
                              </span>
                            ) : (
                              <FileText />
                            )}
                            <span>{s.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </div>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button type="button">
                <User2 />
                <span>{username || 'User'}</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button onClick={logout}>
                <span>Logout</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </ShadSidebar>
  )
}


