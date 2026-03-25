export function slugifyTitle(title: string): string {
  return (title || 'untitled')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function makeSlug(title: string, id: string): string {
  return `${slugifyTitle(title)}-${id}`
}

export function extractIdFromSlug(slug: string): string | null {
  const parts = (slug || '').split('-')
  const last = parts[parts.length - 1]
  if (last && /^[a-f0-9]{24}$/i.test(last)) return last
  return null
}


