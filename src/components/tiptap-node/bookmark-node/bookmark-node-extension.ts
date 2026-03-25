import { Node, mergeAttributes } from '@tiptap/core'
import { api } from '@/lib/utils'

export interface BookmarkAttrs {
  href: string
  title?: string
  description?: string
  image?: string | null
  favicon?: string | null
  domain?: string
}

export const BookmarkNode = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return { href: { default: null }, title: { default: null }, description: { default: null }, image: { default: null }, favicon: { default: null }, domain: { default: null } }
  },

  parseHTML() { return [{ tag: 'div[data-type="bookmark"]' }] },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'bookmark', class: 'bookmark-card' }), 0]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'bookmark-card'
      dom.dataset.type = 'bookmark'

      const a = document.createElement('a')
      a.href = node.attrs.href
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.className = 'bookmark-inner'

      const left = document.createElement('div')
      left.className = 'bookmark-left'

      const favicon = document.createElement('img')
      favicon.className = 'bookmark-favicon'
      favicon.alt = ''
      if (node.attrs.favicon) favicon.src = node.attrs.favicon

      const title = document.createElement('div')
      title.className = 'bookmark-title'
      title.textContent = node.attrs.title || node.attrs.href

      const desc = document.createElement('div')
      desc.className = 'bookmark-desc'
      desc.textContent = node.attrs.description || ''

      const domain = document.createElement('div')
      domain.className = 'bookmark-domain'
      domain.textContent = node.attrs.domain || ''

      left.appendChild(favicon)
      left.appendChild(title)
      left.appendChild(desc)
      left.appendChild(domain)

      const imgWrap = document.createElement('div')
      imgWrap.className = 'bookmark-image-wrap'
      const img = document.createElement('img')
      img.className = 'bookmark-image'
      img.alt = ''
      if (node.attrs.image) img.src = node.attrs.image
      imgWrap.appendChild(img)

      a.appendChild(left)
      a.appendChild(imgWrap)
      dom.appendChild(a)

      const loadMeta = async () => {
        try {
          const meta = await api<any>(`/links/metadata?url=${encodeURIComponent(node.attrs.href)}`)
          if (!meta) return
          if (meta.favicon) favicon.src = meta.favicon
          title.textContent = meta.title || node.attrs.href
          desc.textContent = meta.description || ''
          domain.textContent = meta.domain || ''
          if (meta.image) {
            const proxied = `/api/links/image?url=${encodeURIComponent(meta.image)}&ref=${encodeURIComponent(meta.referer || node.attrs.href)}`
            img.src = proxied
          }
        } catch {}
      }
      if (!node.attrs.title) loadMeta()

      return { dom, update: (updated) => updated.type.name === 'bookmark', ignoreMutation: () => true }
    }
  },
})
