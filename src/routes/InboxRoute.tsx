import { useEffect, useState, useMemo } from 'react'
import { Layout } from '@/components/Layout'
import { Header } from '@/components/Header'
import { AppSidebar } from '@/components/Sidebar'
import { api } from '@/lib/utils'
import { Mail, ExternalLink, Search, RefreshCw, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CommandPalette } from '@/components/CommandPalette'

export function InboxRoute() {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle')
  const [authorized, setAuthorized] = useState(true)
  const [query, setQuery] = useState('')

  const fetchInbox = async () => {
    try {
      setLoading(true)
      setSyncStatus('syncing')
      const data = await api('/google/gmail/messages')
      setMessages(data.messages || [])
      setAuthorized(true)
      setSyncStatus('synced')
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (err: any) {
      if (err.message?.includes('authenticated')) {
        setAuthorized(false)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInbox()
  }, [])

  const startAuth = async () => {
    try {
      const { url } = await api('/google/auth/url')
      window.location.href = url
    } catch {}
  }

  const filteredMessages = useMemo(() => {
    if (!query) return messages
    return messages.filter(m => {
      const headers = m.payload?.headers || []
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || ''
      const from = headers.find((h: any) => h.name === 'From')?.value || ''
      return subject.toLowerCase().includes(query.toLowerCase()) || 
             from.toLowerCase().includes(query.toLowerCase()) || 
             m.snippet?.toLowerCase().includes(query.toLowerCase())
    })
  }, [messages, query])

  return (
    <Layout header={<Header title="Inbox" />} sidebar={<AppSidebar />}>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
        <CommandPalette />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-2 border border-orange-200 dark:border-orange-800/40">
                <Mail size={12} /> Inbox
             </div>
             <div className="flex items-center gap-3">
               <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  Messages
               </h1>
               {syncStatus === 'syncing' && <span className="flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full font-bold animate-pulse">Syncing...</span>}
               {syncStatus === 'synced' && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full font-bold animate-in fade-in zoom-in duration-300">✓ Synced to DB</span>}
             </div>
             <p className="text-muted-foreground font-medium max-w-lg">Your synchronized Gmail inbox, powered by AI to help you focus.</p>
          </div>
          
          <div className="flex items-center gap-3">
             <Button variant="outline" size="sm" onClick={fetchInbox} className="rounded-xl border-border/50 hover:bg-muted/80 h-10 px-4 transition-all">
                <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
                Sync
             </Button>
             {!authorized && (
               <Button onClick={startAuth} className="rounded-xl bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20 h-10 px-6 font-bold">
                 Connect Gmail <ExternalLink size={14} className="ml-2" />
               </Button>
             )}
          </div>
        </div>

        {authorized && (
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
              <Search size={18} />
            </div>
            <input 
              type="text"
              placeholder="Search your messages..."
              className="w-full h-14 pl-12 pr-4 bg-muted/40 hover:bg-muted/60 focus:bg-background border-border/40 focus:border-primary/30 rounded-2xl outline-none transition-all text-base shadow-sm font-medium"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {!authorized ? (
          <div className="text-center py-20 bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-border/60 flex flex-col items-center gap-6">
            <div className="p-6 rounded-3xl bg-background shadow-xl border border-border/50">
               <Mail size={48} className="text-orange-500 opacity-80" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Connect your workspace</h2>
              <p className="text-muted-foreground max-w-xs mx-auto">Authorize Motion to access your Gmail and bring your communications into one place.</p>
            </div>
            <Button onClick={startAuth} size="lg" className="rounded-2xl h-12 px-8 bg-orange-500 hover:bg-orange-600 font-bold shadow-lg shadow-orange-500/20">Authorize Gmail</Button>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-28 bg-muted/20 animate-pulse rounded-2xl border border-border/40" />
            ))}
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-24 bg-muted/5 rounded-[2.5rem] border border-border/30">
            <p className="text-muted-foreground font-semibold text-lg italic">
               {query ? `No messages found matching "${query}"` : 'Your inbox is clear! Check back later.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredMessages.map((msg: any) => {
              return (
                <div key={msg.id || msg._id} className="group p-6 rounded-2xl border border-border/40 bg-card hover:bg-accent/40 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 transform-gpu hover:-translate-y-0.5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase tracking-widest text-primary opacity-60">
                           {msg.date ? new Date(msg.date).toLocaleDateString() : 'Recent'}
                         </span>
                         <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="p-1 px-2 rounded-md bg-muted text-[10px] font-bold text-muted-foreground border border-border/50">Stored in MongoDB</span>
                         </div>
                      </div>
                      <h3 className="font-bold text-xl leading-tight group-hover:text-primary transition-colors truncate max-w-full">{msg.subject || '(No Subject)'}</h3>
                      <div className="flex items-center gap-2">
                         <div className="size-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 shrink-0" />
                         <p className="text-sm font-semibold text-foreground/80 truncate">{msg.from || 'Unknown Sender'}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed opacity-80">{msg.snippet}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-center">
                       <Button variant="ghost" size="icon" className="rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary active:scale-90" onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${msg.threadId}`, '_blank')}>
                          <ArrowRight size={20} />
                       </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}

function cn(...args: any[]) {
  return args.filter(Boolean).join(' ')
}
