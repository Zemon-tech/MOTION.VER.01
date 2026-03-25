import { Link } from 'react-router-dom'

type ShareHeaderProps = { 
  title: string,
  ancestors?: Array<{ _id: string; title: string; slug: string; icon?: string | null }>
}

export function ShareHeader({ title, ancestors = [] }: ShareHeaderProps) {
  const loc = window.location
  const isShare = (loc.pathname || '/').startsWith('/s/')
  const base = isShare ? '/s' : ''
  // derive token via ?t= or slug suffix
  const params = new URLSearchParams(loc.search)
  const qToken = params.get('t')
  const pathSlug = (loc.pathname || '/').replace(/^\//, '')
  const di = pathSlug.lastIndexOf('.')
  const dotToken = di > 0 && di < pathSlug.length - 1 ? pathSlug.slice(di + 1) : ''
  const buildHref = (slug: string) => {
    if (qToken) return `${base}/${slug}?t=${encodeURIComponent(qToken)}`
    if (dotToken) return `${base}/${slug}.${dotToken}`
    return `${base}/${slug}`
  }
  return (
    <div className="w-full flex items-center justify-between gap-2 px-3">
      <div className="flex items-baseline gap-3 min-w-0">
        {Array.isArray(ancestors) && ancestors.length > 0 ? (
          <nav className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            {ancestors.map((a) => (
              <span key={a._id} className="inline-flex items-center gap-1 min-w-0">
                <a href={buildHref(a.slug)} className="hover:underline truncate max-w-[18ch]">
                  {a.title || 'Untitled'}
                </a>
                <span className="mx-1">/</span>
              </span>
            ))}
            <span className="truncate max-w-[22ch]">{title || 'Untitled'}</span>
          </nav>
        ) : (
          <span className="text-sm text-muted-foreground truncate">{title || 'Untitled'}</span>
        )}
        <span className="text-[11px] leading-4 text-muted-foreground border rounded px-1.5 py-0.5 ml-2">Public</span>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/" className="inline-flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <span>Login</span>
        </Link>
      </div>
    </div>
  )
}
