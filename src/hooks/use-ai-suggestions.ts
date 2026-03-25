import * as React from 'react'
import type { Editor } from '@tiptap/react'
import { aiSuggestStream } from '@/lib/ai'
import { toMarkdown, fromMarkdown } from '@/lib/markdown'

type UseAiSuggestionsOpts = {
  enabled?: boolean
  mode?: 'brainstorm' | 'continue' | 'find_words' | 'clarify' | 'outline'
  debounceMs?: number
  pageTitle?: string
}

type Suggestion = { markdown: string }

export function useAiSuggestions(editor: Editor | null, opts: UseAiSuggestionsOpts = {}) {
  const enabled = opts.enabled !== false
  const mode = opts.mode || 'brainstorm'
  const debounceMs = typeof opts.debounceMs === 'number' ? opts.debounceMs : 700
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([])
  const timerRef = React.useRef<number | null>(null)

  const getSelectionJson = React.useCallback(() => {
    if (!editor) return null
    const { state } = editor
    if (state.selection.empty) return editor.getJSON()
    try {
      const { from, to } = state.selection
      const slice = state.doc.cut(from, to)
      return { type: 'doc', content: [slice.toJSON()] }
    } catch { return editor.getJSON() }
  }, [editor])

  const getContextJson = React.useCallback(() => {
    if (!editor) return null
    return editor.getJSON()
  }, [editor])

  const trigger = React.useCallback(async () => {
    if (!enabled || !editor) return
    setLoading(true)
    setOpen(true)
    setSuggestions([])
    const selectionJson = getSelectionJson()
    const contextJson = getContextJson()
    const selectionMarkdown = toMarkdown(selectionJson)
    const contextMarkdown = toMarkdown(contextJson)
    try {
      const stream = aiSuggestStream({
        mode,
        selectionMarkdown,
        contextMarkdown,
        pageMeta: { title: opts.pageTitle },
      })
      let acc = ''
      for await (const chunk of stream) {
        acc += chunk
        setSuggestions([{ markdown: acc }])
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [enabled, editor, getSelectionJson, getContextJson, mode, opts.pageTitle])

  const schedule = React.useCallback(() => {
    if (!enabled) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => { trigger() }, debounceMs)
  }, [enabled, trigger, debounceMs])

  React.useEffect(() => {
    if (!editor || !enabled) return
    const onTxn = (payload: any) => {
      // payload.transaction?.docChanged is available from TipTap event
      if (payload?.transaction?.docChanged) schedule()
    }
    editor.on('transaction', onTxn as any)
    return () => {
      editor.off('transaction', onTxn as any)
    }
  }, [editor, enabled, schedule])

  const applySuggestion = React.useCallback((s: Suggestion, replace: boolean) => {
    if (!editor) return
    const json = fromMarkdown(s.markdown)
    const contentToInsert = (json as any)?.content ?? json
    if (replace) {
      editor.chain().focus().deleteSelection().insertContent(contentToInsert as any).run()
    } else {
      editor.chain().focus().insertContent({ type: 'paragraph' }).insertContent(contentToInsert as any).run()
    }
    setOpen(false)
  }, [editor])

  return { open, loading, suggestions, setOpen, applySuggestion, trigger }
}
