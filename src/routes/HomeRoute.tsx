import { Layout } from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/Header'
import { AppSidebar } from '@/components/Sidebar'
import { Card ,CardContent, CardHeader } from '@/components/ui/card'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Calendar,Clock, FileText,  MoreHorizontal, NotebookPen, Star } from 'lucide-react'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { api } from '@/lib/utils'
import { Link } from 'react-router-dom'

const Section = ({ title, children, action }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <NotebookPen className="size-4" />
        <span>{title}</span>
      </div>
      {action}
    </div>
    {children}
  </section>
)


const ThumbCard = ({ label, meta, cover, icon, to }: { label: string; meta?: string; cover?: string | null; icon?: string | null; to?: string }) => (
  <Link to={to || '#'} className="block">
    <Card className="relative w-40 overflow-hidden rounded-xl border border-[color:var(--border)]/60 bg-[color:var(--background)]/90 p-3">
      <div className="relative h-20 bg-[color:var(--muted)]/60 overflow-hidden -mx-3 -mt-3">
        {cover ? (
          <div className="h-full w-full bg-center bg-cover" style={{ backgroundImage: `url(${cover})` }} />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground/70">
            <FileText className="size-4" />
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute left-3 top-20 -translate-y-1/2 z-10 text-[40px] leading-none">
        {icon ? (
          <span className="align-middle select-none">{icon}</span>
        ) : (
          <FileText className="inline-block align-middle text-foreground/90" />
        )}
      </div>
      <div className="pt-2 pb-0.5">
        <div className="text-[20px] left-3 font-semibold leading-tight truncate">{label}</div>
        {meta ? (
          <div className="mt-1 flex items-center gap-1 text-[8px] text-muted-foreground">
            <Clock className="size-2" />
            <span>{meta}</span>
          </div>
        ) : null}
      </div>
    </Card>
  </Link>
);

function LargeThumbCard({ label, meta, cover, className = "" }: { label: string; meta?: string; cover?: string; className?: string }) {
  return (
    <Card className={`overflow-hidden rounded-xl border border-[color:var(--border)]/60 bg-[color:var(--background)]/90 p-4 ${className}`}>
      <div className="h-32 bg-[color:var(--muted)]/60 overflow-hidden -mx-4 -mt-4 rounded-t-xl">
        {cover ? (
          <div className="h-full w-full bg-center bg-cover" style={{ backgroundImage: `url(${cover})` }} />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground/70">
            <FileText className="size-5" />
          </div>
        )}
      </div>
      <div className="pt-3">
        <div className="text-[14px] sm:text-[15px] font-semibold leading-tight">{label}</div>
        {meta ? (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{meta}</span>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

export function HomeRoute() {
  const greeting = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date())
  const hour = Number(greeting.replace(/[^0-9]/g, '')) || new Date().getHours()
  const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // Embla-driven mask visibility
  const [recentApi, setRecentApi] = useState<any | null>(null)
  const [recentCanPrev, setRecentCanPrev] = useState(false)
  const [recentCanNext, setRecentCanNext] = useState(false)
  const [tplApi, setTplApi] = useState<any | null>(null)
  const [tplCanPrev, setTplCanPrev] = useState(false)
  const [tplCanNext, setTplCanNext] = useState(false)
  const [recentPages, setRecentPages] = useState<any[]>([])
  const [hideLocked, setHideLocked] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('hideLocked')
      return v == null ? true : v === '1'
    } catch { return true }
  })

  const relativeTime = useMemo(() => {
    const rtf = typeof Intl !== 'undefined' && (Intl as any).RelativeTimeFormat ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null
    return (dateStr?: string) => {
      if (!dateStr) return ''
      const now = Date.now()
      const then = new Date(dateStr).getTime()
      const diff = then - now
      const abs = Math.abs(diff)
      const minutes = Math.round(diff / (60 * 1000))
      const hours = Math.round(diff / (60 * 60 * 1000))
      const days = Math.round(diff / (24 * 60 * 60 * 1000))
      if (rtf) {
        if (abs < 60 * 60 * 1000) return rtf.format(minutes, 'minute')
        if (abs < 24 * 60 * 60 * 1000) return rtf.format(hours, 'hour')
        return rtf.format(days, 'day')
      }
      // Fallback
      if (abs < 60 * 60 * 1000) return `${Math.abs(minutes)}m ago`
      if (abs < 24 * 60 * 60 * 1000) return `${Math.abs(hours)}h ago`
      return `${Math.abs(days)}d ago`
    }
  }, [])

  useEffect(() => {
    api('/pages')
      .then((data: any) => {
        const pages = Array.isArray(data?.pages) ? data.pages : []
        // Build recent-visited rank map from localStorage
        let rank: Record<string, number> = {}
        try {
          const raw = localStorage.getItem('recentVisited')
          const arr: Array<{ slug: string; ts: number }> = raw ? JSON.parse(raw) : []
          rank = arr.reduce((acc, cur, idx) => { acc[cur.slug] = idx; return acc }, {} as Record<string, number>)
        } catch {}
        pages.sort((a: any, b: any) => {
          const ra = typeof a.slug === 'string' && a.slug in rank ? rank[a.slug] : Number.POSITIVE_INFINITY
          const rb = typeof b.slug === 'string' && b.slug in rank ? rank[b.slug] : Number.POSITIVE_INFINITY
          if (ra !== rb) return ra - rb
          // Fallback: updatedAt/createdAt desc
          const ta = new Date(a.updatedAt || a.createdAt || 0).getTime()
          const tb = new Date(b.updatedAt || b.createdAt || 0).getTime()
          return tb - ta
        })
        setRecentPages(pages)
      })
      .catch(() => {})
  }, [])

  // Keep hideLocked in sync with Sidebar toggle
  useEffect(() => {
    const onChange = () => {
      try {
        const v = localStorage.getItem('hideLocked')
        setHideLocked(v == null ? true : v === '1')
      } catch {}
    }
    window.addEventListener('hideLocked-changed', onChange)
    return () => window.removeEventListener('hideLocked-changed', onChange)
  }, [])

  const visibleRecentPages = useMemo(() => {
    return hideLocked ? recentPages.filter((p: any) => !p.locked) : recentPages
  }, [recentPages, hideLocked])

  useEffect(() => {
    if (!recentApi) return
    const update = () => {
      setRecentCanPrev(recentApi.canScrollPrev())
      setRecentCanNext(recentApi.canScrollNext())
    }
    update()
    recentApi.on('select', update)
    recentApi.on('reInit', update)
    return () => {
      recentApi.off('select', update)
      recentApi.off('reInit', update)
    }
  }, [recentApi])

  useEffect(() => {
    if (!tplApi) return
    const update = () => {
      setTplCanPrev(tplApi.canScrollPrev())
      setTplCanNext(tplApi.canScrollNext())
    }
    update()
    tplApi.on('select', update)
    tplApi.on('reInit', update)
    return () => {
      tplApi.off('select', update)
      tplApi.off('reInit', update)
    }
  }, [tplApi])

  function SidebarTriggerFloating() {
    const { state, openMobile, isMobile } = useSidebar()
    const show = isMobile ? !openMobile : state === 'collapsed'
    if (!show) return null
    return (
      <div className="fixed top-2 left-2 z-30">
        <SidebarTrigger />
      </div>
    )
  }

  return (
    <Layout header={<Header title={salutation} />} sidebar={<AppSidebar />} hideHeader>
      <div className="h-full overflow-y-auto">
        <div className="min-h-full w-full mx-auto max-w-6xl px-8 md:px-12 lg:px-20 xl:px-28 py-4 pb-16 space-y-10">
        {/* Fixed sidebar trigger like header; hidden when sidebar is open */}
        <SidebarTriggerFloating />
        <div className="h-14 flex items-center justify-center">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">{salutation}</h1>
        </div>
        <Section title="Recently visited">
          <div className="relative group">
            {recentPages.length > 4 && (
              <>
                <div className={`pointer-events-none absolute left-0 top-0 h-full w-20 md:w-28 bg-gradient-to-r from-[color:var(--background)] via-[color:var(--background)]/80 to-transparent transition-opacity z-10 ${recentCanPrev ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`pointer-events-none absolute right-0 top-0 h-full w-20 md:w-28 bg-gradient-to-l from-[color:var(--background)] via-[color:var(--background)]/80 to-transparent transition-opacity z-10 ${recentCanNext ? 'opacity-100' : 'opacity-0'}`} />
              </>
            )}
            <Carousel opts={{ align: 'start', loop: true }} plugins={[WheelGesturesPlugin()] } setApi={setRecentApi}>
              <CarouselContent className="cursor-grab active:cursor-grabbing">
                {(visibleRecentPages.length ? visibleRecentPages : []).slice(0, 20).map((p: any, i: number) => (
                  <CarouselItem key={p._id || i} className="basis-auto pr-3">
                    <ThumbCard
                      label={p.title || 'Untitled'}
                      meta={relativeTime(p.updatedAt || p.createdAt)}
                      cover={p.coverImageUrl}
                      icon={p.icon}
                      to={p.slug ? `/${p.slug}` : undefined}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {recentPages.length > 4 && (
                <>
                  <CarouselPrevious className="-left-3 invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-20" />
                  <CarouselNext className="-right-3 invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-20" />
                </>
              )}
            </Carousel>
          </div>
        </Section>

        <Separator />

        <Section
          title="Learn"
          action={
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <LargeThumbCard
                key={i}
                label="The ultimate guide to Notion templates"
                meta={`${i + 3}m read`}
                cover={i % 2 === 0 ? '/vite.svg' : '/motion.svg'}
                className="w-full"
              />
            ))}
          </div>
        </Section>

        <Separator />

        <Section
          title="Upcoming events"
          action={
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        >
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="size-4" />
                <span>Connect AI Meeting Notes with your Calendar events</span>
              </div>
              <Button variant="secondary" size="sm">Connect Notion Calendar</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-muted-foreground">
                <div className="space-y-2">
                  <div className="rounded-lg border border-[color:var(--border)]/50 p-4">
                    <div className="text-xs mb-1">Today</div>
                    <div className="font-medium text-foreground">Team standup</div>
                    <div className="text-xs">9 AM · Office</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg border border-[color:var(--border)]/50 p-4">
                    <div className="text-xs mb-1">Sat • Oct 25</div>
                    <div className="font-medium text-foreground">Project check-in</div>
                    <div className="text-xs">10 AM · Office</div>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <Button variant="ghost" className="gap-2">
                    <Star className="size-4" />
                    <span>Join and take notes</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Section>

        <Separator />

        <Section title="Home views">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
                <div className="rounded-md border border-[color:var(--border)]/70 size-12 inline-flex items-center justify-center">
                  <FileText className="size-5" />
                </div>
                <div>
                  <div className="text-foreground font-medium">Pin a database view</div>
                  <div>Quickly access it from Home.</div>
                </div>
              </div>
              <div className="md:col-span-2 p-6">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-muted-foreground">Activity</div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="text-muted-foreground">—</div>
                  {[
                    ['Wake up and freshen up', 'Done'],
                    ['Have breakfast', 'In progress'],
                    ['Work or study', 'Not started'],
                    ['Have lunch', 'Not started'],
                    ['Exercise', 'Not started'],
                  ].map(([a, s], idx) => (
                    <>
                      <div key={`a-${idx}`}>{a}</div>
                      <div key={`s-${idx}`}>{s}</div>
                      <div key={`d-${idx}`} className="text-right">
                        <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
                      </div>
                    </>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </Section>

        <Separator />

        <Section title="Featured templates" action={<Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>}>
          <div className="relative group">
            {/* edge gradients */}
            <div className={`pointer-events-none absolute left-0 top-0 h-full w-20 md:w-28 bg-gradient-to-r from-[color:var(--background)] via-[color:var(--background)]/80 to-transparent transition-opacity z-10 ${tplCanPrev ? 'opacity-100' : 'opacity-0'}`} />
            <div className={`pointer-events-none absolute right-0 top-0 h-full w-20 md:w-28 bg-gradient-to-l from-[color:var(--background)] via-[color:var(--background)]/80 to-transparent transition-opacity z-10 ${tplCanNext ? 'opacity-100' : 'opacity-0'}`} />
            <Carousel opts={{ align: 'start', loop: true }} plugins={[WheelGesturesPlugin()] } setApi={setTplApi}>
              <CarouselContent>
                {[1,2,3,4,5,6].map((i) => (
                  <CarouselItem key={i} className="basis-auto pr-4">
                    <LargeThumbCard
                      label={`Template ${i}`}
                      meta="By Notion"
                      cover={i % 2 === 0 ? '/vite.svg' : '/motion.svg'}
                      className="w-72"
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="-left-3 invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-20" />
              <CarouselNext className="-right-3 invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-20" />
            </Carousel>
          </div>
        </Section>
        </div>
      </div>
    </Layout>
  )
}

export default HomeRoute
