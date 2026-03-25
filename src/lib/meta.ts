export function setDocumentTitle(title: string) {
  document.title = title || 'Pages'
}

// Cache for theme-adaptive favicon data URLs
let __faviconCache: { light: string | null; dark: string | null; preparing: Promise<void> | null; mediaBound: boolean } = {
  light: null,
  dark: null,
  preparing: null,
  mediaBound: false,
}

function recolorSvgToMonochrome(svg: string, hex: string) {
  // Force fills/strokes to the specified color. This is a heuristic but works for typical path-heavy icons.
  const replaceFill = svg.replace(/fill="#?[0-9a-fA-F]{3,8}"/g, `fill="${hex}"`)
  const replaceStroke = replaceFill.replace(/stroke="#?[0-9a-fA-F]{3,8}"/g, `stroke="${hex}"`)
  // Also ensure root gets a default current fill if missing
  const withStyle = replaceStroke.includes('<style')
    ? replaceStroke
    : replaceStroke.replace(
        /<svg\b([^>]*)>/,
        (m) => `${m}<style>*{fill:${hex} !important;stroke:${hex} !important}</style>`,
      )
  return withStyle
}

async function ensureFaviconCache() {
  if (__faviconCache.preparing) return __faviconCache.preparing
  __faviconCache.preparing = (async () => {
    try {
      const res = await fetch('/motion.svg', { cache: 'force-cache' })
      const svg = await res.text()
      const lightSvg = recolorSvgToMonochrome(svg, '#000')
      const darkSvg = recolorSvgToMonochrome(svg, '#fff')
      __faviconCache.light = 'data:image/svg+xml;utf8,' + encodeURIComponent(lightSvg)
      __faviconCache.dark = 'data:image/svg+xml;utf8,' + encodeURIComponent(darkSvg)
    } catch {
      // Fallback to raw logo if fetch fails
      __faviconCache.light = '/motion.svg'
      __faviconCache.dark = '/motion.svg'
    }
  })()
  return __faviconCache.preparing
}

function applyFaviconUrl(url: string) {
  const ensureLink = (rel: string) => {
    let el = document.querySelector(`link[rel='${rel}']`) as HTMLLinkElement | null
    if (!el) {
      el = document.createElement('link')
      el.rel = rel
      document.head.appendChild(el)
    }
    const isSvg = url.startsWith('data:image/svg') || url.endsWith('.svg')
    el.type = isSvg ? 'image/svg+xml' : ''
    el.href = url
  }
  ensureLink('icon')
  ensureLink('shortcut icon')
}

function bindThemeListener() {
  if (__faviconCache.mediaBound) return
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (!__faviconCache.light || !__faviconCache.dark) return
    const url = mq.matches ? __faviconCache.dark : __faviconCache.light
    applyFaviconUrl(url)
  }
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', handler)
  } else if (typeof (mq as any).addListener === 'function') {
    ;(mq as any).addListener(handler)
  }
  __faviconCache.mediaBound = true
}

export function setFavicon(href?: string) {
  // If caller explicitly passes a URL, set it directly.
  if (href && href !== '/motion.svg') {
    applyFaviconUrl(href)
    return
  }
  // Default behavior: theme-adaptive brand favicon
  ensureFaviconCache().then(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const url = mq.matches ? (__faviconCache.dark || '/motion.svg') : (__faviconCache.light || '/motion.svg')
    applyFaviconUrl(url)
    bindThemeListener()
  })
}

export function setFaviconFromIcon(icon?: string | null) {
  if (!icon) {
    // Use theme-adaptive brand favicon when no page icon is set
    setFavicon()
    return
  }
  const isUrl = /^https?:\/\//i.test(icon)
  if (isUrl) {
    setFavicon(icon)
    return
  }
  // Treat as emoji; render emoji SVG data URL with transparent background
  const emoji = icon
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>
    <text x='50%' y='50%' font-size='48' text-anchor='middle' dominant-baseline='central'>${emoji}</text>
  </svg>`
  const data = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  setFavicon(data)
}

function setOrCreateMeta(nameOrProperty: { name?: string; property?: string }, content: string) {
  const selector = nameOrProperty.name ? `meta[name='${nameOrProperty.name}']` : `meta[property='${nameOrProperty.property}']`
  let el = document.head.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    if (nameOrProperty.name) el.name = nameOrProperty.name
    if (nameOrProperty.property) el.setAttribute('property', nameOrProperty.property)
    document.head.appendChild(el)
  }
  el.content = content
}

export function setSocialMeta(opts: { title?: string; description?: string; image?: string; url?: string }) {
  if (opts.title) {
    setOrCreateMeta({ property: 'og:title' }, opts.title)
    setOrCreateMeta({ name: 'twitter:title' }, opts.title)
  }
  if (opts.description) {
    setOrCreateMeta({ property: 'og:description' }, opts.description)
    setOrCreateMeta({ name: 'twitter:description' }, opts.description)
  }
  if (opts.image) {
    setOrCreateMeta({ property: 'og:image' }, opts.image)
    setOrCreateMeta({ name: 'twitter:image' }, opts.image)
    setOrCreateMeta({ name: 'twitter:card' }, 'summary_large_image')
  }
  if (opts.url) {
    setOrCreateMeta({ property: 'og:url' }, opts.url)
  }
}
