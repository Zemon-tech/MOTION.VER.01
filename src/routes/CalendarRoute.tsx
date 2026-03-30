import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Header } from '@/components/Header'
import { AppSidebar } from '@/components/Sidebar'
import { api } from '@/lib/utils'
import { Calendar as CalendarIcon, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TodoCalendar } from '@/components/TodoCalendar'
import { CommandPalette } from '@/components/CommandPalette'
import { format } from 'date-fns'

export function CalendarRoute() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(true)

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const data = await api('/google/calendar/events')
      setEvents(data.events || [])
      setAuthorized(true)
    } catch (err: any) {
      if (err.message?.includes('authenticated')) {
        setAuthorized(false)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const startAuth = async () => {
    try {
      const { url } = await api('/google/auth/url')
      window.location.href = url
    } catch {}
  }

  return (
    <Layout header={<Header title="Calendar" />} sidebar={<AppSidebar />}>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
        <CommandPalette />
        
        {/* Unified Calendar Section */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div>
                <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  Calendar
                </h1>
                <p className="text-muted-foreground font-medium mt-1">Manage your schedule and daily tasks in one place.</p>
             </div>
             <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={fetchEvents} className="rounded-xl border-border/50 hover:bg-muted/80 h-10 px-4 transition-all">
                   <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
                   Sync
                </Button>
                {!authorized && (
                  <Button onClick={startAuth} className="rounded-xl bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20 h-10 px-6 font-bold">
                    Connect Google <ExternalLink size={14} className="ml-2" />
                  </Button>
                )}
             </div>
          </div>

          <TodoCalendar />
        </section>

        {/* Google Events Side Section/Modal or List */}
        {authorized && (
          <section className="space-y-6 pt-12 border-t border-border/40">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                    <CalendarIcon size={20} />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight">Google Calendar</h2>
               </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-2xl border border-border/50" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-16 bg-muted/10 rounded-3xl border-2 border-dashed border-border/60">
                <p className="text-muted-foreground font-medium italic">No upcoming events discovered. Time to plan something!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event: any) => (
                  <div key={event.id} className="group p-5 rounded-2xl border border-border/50 bg-card hover:bg-accent/30 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 opacity-70">
                          {event.start?.dateTime ? format(new Date(event.start.dateTime), 'MMM d, h:mm a') : 'All Day Event'}
                        </div>
                        <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-1">{event.summary || 'Untitled Event'}</h3>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {event.description || 'No description provided.'}
                        </p>
                      </div>
                      {event.htmlLink && (
                        <a href={event.htmlLink} target="_blank" rel="noreferrer" className="shrink-0 p-2 rounded-lg bg-muted text-muted-foreground hover:bg-primary hover:text-white transition-all shadow-sm">
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </Layout>
  )
}

function cn(...args: any[]) {
  return args.filter(Boolean).join(' ')
}
