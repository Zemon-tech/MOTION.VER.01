import React from 'react'
import { Command } from 'cmdk'
import { Search, FileText, Calendar, Mail, Loader2, Clock, Zap, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/utils'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<any[]>([])
  const [recent, setRecent] = React.useState<any[]>([])
  const [allPages, setAllPages] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    const openFromEvent = () => setOpen(true)
    document.addEventListener('keydown', down)
    window.addEventListener('open-command-palette', openFromEvent)
    
    // Load recent pages from local storage
    try {
      const raw = localStorage.getItem('recentVisited')
      const items = raw ? JSON.parse(raw) : []
      setRecent(items.slice(0, 5))
    } catch {}

    // Fetch all pages when opened to show in search
    if (open) {
      api('/pages').then(res => {
        if (res.pages) setAllPages(res.pages)
      }).catch(() => {})
    }

    return () => {
      document.removeEventListener('keydown', down)
      window.removeEventListener('open-command-palette', openFromEvent)
    }
  }, [open])

  const fetchResults = React.useCallback(async (q: string) => {
    if (!q) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const [pageData, googleData] = await Promise.all([
        api(`/pages/search?q=${encodeURIComponent(q)}`),
        api(`/google/search?q=${encodeURIComponent(q)}`).catch(() => ({ results: [] }))
      ])
      
      const merged = [
        ...(pageData.pages || []).map((p: any) => ({ ...p, type: 'page' })),
        ...(googleData.results || [])
      ]
      setResults(merged)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (query) fetchResults(query)
      else setResults([])
    }, 200)
    return () => clearTimeout(timer)
  }, [query, fetchResults])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 overflow-hidden border-none shadow-2xl max-w-2xl bg-transparent top-[28%]" showCloseButton={false}>
        <Command className="rounded-2xl border border-border/60 bg-popover/95 backdrop-blur-xl text-popover-foreground shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-200 ring-1 ring-black/5 dark:ring-white/5">
          <div className="flex items-center border-b border-border/40 px-5 py-4" cmdk-input-wrapper="">
            <Search className="mr-3 h-5 w-5 shrink-0 opacity-50 text-primary" />
            <Command.Input
              placeholder="Search pages, files, calendar..."
              value={query}
              onValueChange={setQuery}
              autoFocus
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-lg outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed font-medium"
            />
            {loading ? <Loader2 className="ml-3 h-5 w-5 animate-spin text-primary" /> : <div className="text-[10px] font-black bg-muted/60 px-1.5 py-0.5 rounded border border-border/50 opacity-40">ESC</div>}
          </div>
          
          <Command.List className="max-h-[450px] overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
            {!loading && query && results.length === 0 && (
              <Command.Empty className="py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                   <div className="p-4 rounded-full bg-muted/20 text-muted-foreground/30">
                      <Search className="size-8" />
                   </div>
                   <p className="text-sm font-medium text-muted-foreground">No matches found for <span className="text-foreground font-bold underline underline-offset-4 decoration-primary/40">"{query}"</span></p>
                </div>
              </Command.Empty>
            )}
            
            {/* Recent Pages Section */}
            {!query && recent.length > 0 && (
              <Command.Group heading={<div className="flex items-center gap-2 px-2 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60"><Clock className="size-3" /> Recent</div>}>
                {recent.map((item: any) => (
                  <Command.Item
                    key={`recent:${item.slug}`}
                    onSelect={() => { setOpen(false); navigate(`/${item.slug}`) }}
                    className="flex cursor-pointer select-none items-center rounded-xl p-3 text-sm outline-none aria-selected:bg-accent/80 aria-selected:text-accent-foreground data-[disabled]:pointer-events-none transition-all duration-200 mb-1"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 mr-4 shadow-sm">
                      {item.icon || <FileText className="h-5 w-5" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold truncate text-base">{item.title || 'Untitled'}</span>
                      <span className="text-[10px] uppercase font-black text-muted-foreground/50 tracking-wider">Visited recently</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* All Active Pages Section */}
            {!query && allPages.length > 0 && (
              <Command.Group heading={<div className="flex items-center gap-2 px-2 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60"><FileText className="size-3" /> All Active Pages</div>}>
                {allPages.map((item: any) => (
                  <Command.Item
                    key={`all:${item._id || item.id}`}
                    onSelect={() => { setOpen(false); navigate(`/${item.slug}`) }}
                    className="flex cursor-pointer select-none items-center rounded-xl p-3 text-sm outline-none aria-selected:bg-accent/80 aria-selected:text-accent-foreground data-[disabled]:pointer-events-none transition-all duration-200 mb-1"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mr-4 shadow-sm">
                      {item.icon || <FileText className="h-5 w-5" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold truncate text-base">{item.title || 'Untitled'}</span>
                      <span className="text-[10px] uppercase font-black text-muted-foreground/50 tracking-wider">Page</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Quick Actions if query is short */}
            {!query && (
               <Command.Group heading={<div className="flex items-center gap-2 px-2 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60"><Zap className="size-3" /> Quick Actions</div>}>
                  <Command.Item onSelect={() => { setOpen(false); navigate('/inbox') }} className="flex cursor-pointer select-none items-center rounded-xl p-3 text-sm outline-none aria-selected:bg-accent/80 mb-1">
                     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 mr-4"><Mail className="size-5" /></div>
                     <span className="font-bold text-base">Check Inbox</span>
                  </Command.Item>
                  <Command.Item onSelect={() => { setOpen(false); navigate('/calendar') }} className="flex cursor-pointer select-none items-center rounded-xl p-3 text-sm outline-none aria-selected:bg-accent/80 mb-1">
                     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 mr-4"><Calendar className="size-5" /></div>
                     <span className="font-bold text-base">Open Calendar</span>
                  </Command.Item>
               </Command.Group>
            )}
            
            {results.length > 0 && (
              <Command.Group heading={<div className="flex items-center gap-2 px-2 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60"><Search className="size-3" /> Search Results</div>}>
                {results.map((item: any, i: number) => (
                  <Command.Item
                    key={item.id || item._id || i}
                    onSelect={() => {
                      setOpen(false)
                      if (item.type === 'page') navigate(`/${item.slug}`)
                      else if (item.type === 'calendar' && item.htmlLink) window.open(item.htmlLink, '_blank')
                    }}
                    className="flex cursor-pointer select-none items-center rounded-xl p-3 text-sm outline-none aria-selected:bg-primary/10 aria-selected:ring-1 aria-selected:ring-primary/20 data-[disabled]:pointer-events-none transition-all duration-200 mb-1"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/50 border border-border/40 mr-4 shadow-sm group-aria-selected:bg-primary/20">
                      {item.type === 'page' ? (
                        item.icon || <FileText className="h-5 w-5 text-blue-500" />
                      ) : item.type === 'calendar' ? (
                        <Calendar className="h-5 w-5 text-orange-500" />
                      ) : (
                        <Mail className="h-5 w-5 text-emerald-500" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold truncate text-base leading-tight">{item.title || item.summary || item.snippet}</span>
                      <span className="text-[10px] text-muted-foreground/70 uppercase font-black tracking-widest mt-0.5">
                        {item.type === 'page' ? `Last edited • ${new Date(item.updatedAt).toLocaleDateString()}` : item.type}
                      </span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          
          <div className="border-t border-border/40 p-3 bg-muted/10 flex items-center justify-between">
             <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground/60">
                <div className="flex items-center gap-1.5"><span className="bg-muted px-1.5 py-0.5 rounded border border-border/60">↑↓</span> to navigate</div>
                <div className="flex items-center gap-1.5"><span className="bg-muted px-1.5 py-0.5 rounded border border-border/60">ENTER</span> to open</div>
             </div>
             <div className="text-[10px] font-bold text-primary/60 italic">Precision Search</div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
