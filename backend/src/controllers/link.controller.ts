import type { Request, Response } from 'express'

function safeText(s?: string | null) {
  return (s || '').toString().trim().slice(0, 2000)
}

function extractMetaTag(html: string, selector: RegExp) {
  const m = html.match(selector)
  return m?.[1] ? safeText(m[1]) : ''
}

function firstHttpUrl(s: string) {
  if (!s) return ''
  const idx = s.indexOf('http')
  if (idx > 0) s = s.slice(idx)
  // split on another http occurrence (concatenated URLs) or whitespace
  const m = s.match(/https?:[^\s"']+/i)
  return m?.[0] || ''
}

export async function getUrlMetadata(req: Request, res: Response) {
  try {
    const raw = (req.query.url as string) || ''
    let target: URL
    try { target = new URL(raw) } catch { return res.status(400).json({ error: 'Invalid url' }) }

    const abort = new AbortController()
    const id = setTimeout(() => abort.abort(), 8000)
    const r = await fetch(target.toString(), {
      signal: abort.signal,
      redirect: 'follow' as any,
      headers: {
        // Realistic desktop UA
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
      },
    })
    clearTimeout(id)
    const contentType = r.headers.get('content-type') || ''
    const isHTML = contentType.includes('text/html') || contentType.includes('application/xhtml')
    const html = isHTML ? await r.text() : ''

    const title = extractMetaTag(html, /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["'][^>]*>/i) ||
                  extractMetaTag(html, /<title[^>]*>([^<]*)<\/title>/i)
    const description = extractMetaTag(html, /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["'][^>]*>/i) ||
                        extractMetaTag(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i)
    let image = extractMetaTag(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["'][^>]*>/i)
      || extractMetaTag(html, /<meta\s+name=["']og:image["']\s+content=["']([^"']+)["'][^>]*>/i)
      || extractMetaTag(html, /<meta\s+name=["']twitter:image[:]?\w*["']\s+content=["']([^"']+)["'][^>]*>/i)
    image = firstHttpUrl(image)
    // favicon candidates
    const iconHref = extractMetaTag(html, /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)
      || extractMetaTag(html, /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["'][^>]*>/i)
      || extractMetaTag(html, /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)

    const origin = target.origin
    const domain = target.hostname
    let favicon = `${origin}/favicon.ico`
    if (iconHref) {
      try { favicon = new URL(iconHref, origin).toString() } catch {}
    }

    return res.json({
      url: target.toString(),
      origin,
      domain,
      title: safeText(title) || domain,
      description: safeText(description),
      image: image ? new URL(image, origin).toString() : null,
      favicon,
      referer: target.toString(),
    })
  } catch (e) {
    return res.status(500).json({ error: 'metadata_fetch_failed' })
  }
}

export async function proxyImage(req: Request, res: Response) {
  try {
    const raw = (req.query.url as string) || ''
    const ref = (req.query.ref as string) || ''
    let url: URL
    try { url = new URL(firstHttpUrl(raw)) } catch { return res.status(400).send('bad url') }
    const abort = new AbortController()
    const id = setTimeout(() => abort.abort(), 8000)
    const r = await fetch(url.toString(), {
      signal: abort.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'referer': ref || url.origin,
        'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
      redirect: 'follow' as any,
    })
    clearTimeout(id)
    const ct = r.headers.get('content-type') || 'image/*'
    const buf = new Uint8Array(await r.arrayBuffer())
    res.setHeader('content-type', ct)
    res.setHeader('cache-control', 'public, max-age=86400')
    return res.status(r.ok ? 200 : r.status).send(Buffer.from(buf))
  } catch {
    return res.status(500).send('proxy_failed')
  }
}
