import { Node, mergeAttributes } from '@tiptap/core'
import { api } from '@/lib/utils'

export interface LinkMentionAttrs {
  href: string
  title?: string
  favicon?: string | null
  domain?: string
}

export const LinkMentionNode = Node.create({
  name: 'linkMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: null },
      title: { default: null },
      favicon: { default: null },
      domain: { default: null },
    }
  },

  parseHTML() { return [{ tag: 'span[data-type="link-mention"]' }] },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'link-mention', class: 'link-mention' }), 0]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'link-mention'
      dom.dataset.type = 'link-mention'

      const a = document.createElement('a')
      a.href = node.attrs.href
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.className = 'link-mention-inner'

      const icon = document.createElement('img')
      icon.className = 'link-mention-favicon'
      icon.alt = ''
      const domain = (() => { try { return new URL(node.attrs.href).hostname } catch { return '' } })()
      const ddgFavicon = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : ''
      icon.referrerPolicy = 'no-referrer'
      icon.decoding = 'async'
      icon.loading = 'lazy'
      icon.src = node.attrs.favicon || ddgFavicon
      icon.onerror = () => {
        if (icon.src !== ddgFavicon && ddgFavicon) {
          icon.src = ddgFavicon
        } else {
          icon.style.display = 'none'
        }
      }

      const text = document.createElement('span')
      text.className = 'link-mention-text'
      text.textContent = node.attrs.title || node.attrs.domain || node.attrs.href

      a.appendChild(icon)
      a.appendChild(text)
      dom.appendChild(a)

      const loadMeta = async () => {
        try {
          const meta = await api<any>(`/links/metadata?url=${encodeURIComponent(node.attrs.href)}`)
          if (meta?.favicon) {
            icon.style.display = ''
            icon.src = meta.favicon
          }
          text.textContent = meta?.title || meta?.domain || node.attrs.href
        } catch {}
      }
      if (!node.attrs.title) loadMeta()

      return { dom, update: (updated) => updated.type.name === 'linkMention', ignoreMutation: () => true }
    }
  },
})
