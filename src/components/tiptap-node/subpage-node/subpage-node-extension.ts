import { Node, mergeAttributes } from '@tiptap/core'
import { api } from '@/lib/utils'

export interface SubpageAttrs {
  pageId: string
  slug?: string
}

export const SubpageNode = Node.create({
  name: 'subpage',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      pageId: { default: null },
      slug: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="subpage"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(HTMLAttributes, { 'data-type': 'subpage', class: 'subpage-block' })
    const slug = HTMLAttributes.slug ? String(HTMLAttributes.slug) : ''
    return [
      'div',
      attrs,
      ['div', { class: 'subpage-inner', 'data-slug': slug },
        ['span', { class: 'subpage-icon' }, ''],
        ['span', { class: 'subpage-title' }, 'Untitled'],
      ],
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'subpage-block'
      dom.dataset.type = 'subpage'
      const inner = document.createElement('div')
      inner.className = 'subpage-inner'
      inner.dataset.slug = String(node.attrs.slug || '')

      const iconEl = document.createElement('span')
      iconEl.className = 'subpage-icon'

      // Default Lucide FileText icon (inline SVG) as fallback when no custom icon
      const defaultIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      defaultIcon.setAttribute('width', '16')
      defaultIcon.setAttribute('height', '16')
      defaultIcon.setAttribute('viewBox', '0 0 24 24')
      defaultIcon.setAttribute('fill', 'none')
      defaultIcon.setAttribute('stroke', 'currentColor')
      defaultIcon.setAttribute('stroke-width', '2')
      defaultIcon.setAttribute('stroke-linecap', 'round')
      defaultIcon.setAttribute('stroke-linejoin', 'round')
      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path1.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z')
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
      poly.setAttribute('points', '14 2 14 8 20 8')
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line1.setAttribute('x1', '16')
      line1.setAttribute('y1', '13')
      line1.setAttribute('x2', '8')
      line1.setAttribute('y2', '13')
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line2.setAttribute('x1', '16')
      line2.setAttribute('y1', '17')
      line2.setAttribute('x2', '8')
      line2.setAttribute('y2', '17')
      defaultIcon.appendChild(path1)
      defaultIcon.appendChild(poly)
      defaultIcon.appendChild(line1)
      defaultIcon.appendChild(line2)

      const titleEl = document.createElement('span')
      titleEl.className = 'subpage-title'
      titleEl.textContent = 'Untitled'

      // layout: default icon svg, then optional emoji, then title
      inner.appendChild(defaultIcon)
      inner.appendChild(iconEl)
      inner.appendChild(titleEl)
      dom.appendChild(inner)

      dom.addEventListener('click', (e) => {
        e.preventDefault()
        const ds = (inner && inner.dataset ? inner.dataset.slug : '') as string
        const childSlug = ds && ds.length > 0 ? ds : (node.attrs.slug as string)
        if (!childSlug) return
        // Propagate share token if current page is opened via share link
        // Prefer query parameter ?t=, else use slug suffix .<token>
        const loc = window.location
        const isShare = (loc.pathname || '/').startsWith('/s/')
        const base = isShare ? '/s' : ''
        const params = new URLSearchParams(loc.search)
        const qToken = params.get('t')
        // Propagate any existing unlock token from current page to the child slug keys
        try {
          // Determine current slug without any leading route prefix
          const currentPath = (loc.pathname || '/').replace(/^\/(s\/)?/, '')
          const currentSlug = currentPath
          const currentBaseSlug = currentSlug.includes('.') ? currentSlug.split('.')[0] : currentSlug
          const childBaseSlug = childSlug.includes('.') ? childSlug.split('.')[0] : childSlug
          const curUnlock = sessionStorage.getItem(`unlock:${currentSlug}`) || sessionStorage.getItem(`unlock-base:${currentBaseSlug}`)
          if (curUnlock) {
            try { sessionStorage.setItem(`unlock:${childSlug}`, curUnlock) } catch {}
            try { sessionStorage.setItem(`unlock-base:${childBaseSlug}`, curUnlock) } catch {}
          }
        } catch {}
        if (qToken) {
          window.location.href = `${base}/${childSlug}?t=${encodeURIComponent(qToken)}`
          return
        }
        const pathSlug = (loc.pathname || '/').replace(/^\//, '')
        const di = pathSlug.lastIndexOf('.')
        const dotToken = di > 0 && di < pathSlug.length - 1 ? pathSlug.slice(di + 1) : ''
        if (dotToken) {
          window.location.href = `${base}/${childSlug}.${dotToken}`
        } else {
          window.location.href = `${base}/${childSlug}`
        }
      })

      async function applyMetaById(id: string) {
        try {
          const res = await api<{ pages: Array<{ _id: string; title: string; slug: string; icon: string | null }> }>(`/pages/meta?ids=${id}`)
          const p = Array.isArray(res.pages) ? res.pages.find((x) => String(x._id) === String(id)) : null
          if (!p) return
          inner.dataset.slug = p.slug || ''
          if (p.icon) {
            iconEl.textContent = p.icon
            defaultIcon.style.display = 'none'
            iconEl.style.display = 'inline-flex'
          } else {
            iconEl.textContent = ''
            iconEl.style.display = 'none'
            defaultIcon.style.display = 'inline-block'
          }
          titleEl.textContent = p.title || 'Untitled'
        } catch {}
      }

      // Listen for global meta updates to update this view
      const onMeta = (ev: Event) => {
        const ce = ev as CustomEvent<{ pageId: string; title?: string; icon?: string | null; slug?: string }>
        const { pageId, title, icon, slug } = ce.detail || ({} as any)
        if (!pageId || pageId !== node.attrs.pageId) return
        if (typeof slug === 'string') inner.dataset.slug = slug
        if (typeof icon === 'string' && icon) {
          iconEl.textContent = icon
          defaultIcon.style.display = 'none'
          iconEl.style.display = 'inline-flex'
        } else {
          iconEl.textContent = ''
          iconEl.style.display = 'none'
          defaultIcon.style.display = 'inline-block'
        }
        if (typeof title === 'string') titleEl.textContent = title || 'Untitled'
      }
      window.addEventListener('subpage-meta' as any, onMeta as any)
      // Initial fetch by child ID to ensure independence per node
      if (node.attrs?.pageId) applyMetaById(String(node.attrs.pageId))

      return { dom, ignoreMutation: () => true, update: (updatedNode) => {
        if (updatedNode.type.name !== 'subpage') return false
        // Only touch DOM when something actually changed to avoid flicker
        const newSlug = String(updatedNode.attrs.slug || '')
        if (inner.dataset.slug !== newSlug) {
          inner.dataset.slug = newSlug
        }
        if (updatedNode.attrs.pageId && updatedNode.attrs.pageId !== node.attrs.pageId) {
          applyMetaById(String(updatedNode.attrs.pageId))
        }
        return true
      }, destroy: () => {
        window.removeEventListener('subpage-meta' as any, onMeta as any)
      } }
    }
  },
})
