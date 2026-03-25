import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

function isUrl(text: string) {
  try { const u = new URL(text); return !!u.protocol && !!u.host } catch { return false }
}

export const UrlPasteInterceptor = Extension.create({
  name: 'urlPasteInterceptor',
  addProseMirrorPlugins() {
    const key = new PluginKey('urlPasteInterceptor')
    return [
      new Plugin({
        key,
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData('text/plain')?.trim() || ''
            if (!isUrl(text)) return false
            event.preventDefault()
            const sel = view.state.selection
            const coords = view.coordsAtPos(sel.from)
            const wrapper = document.getElementById('tiptap-editor-wrapper')
            const rect = wrapper?.getBoundingClientRect()
            const x = rect ? coords.left - rect.left : coords.left
            const y = rect ? coords.top - rect.top : coords.top
            window.dispatchEvent(new CustomEvent('paste-url-choice', { detail: { url: text, x, y } }))
            return true
          },
        },
      }),
    ]
  },
})
