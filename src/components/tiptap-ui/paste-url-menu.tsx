"use client"

import * as React from 'react'
import { useEffect, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function PasteUrlMenu({ editor }: { editor: any }) {
  const [open, setOpen] = React.useState(false)
  const [data, setData] = React.useState<{ url: string; x: number; y: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const onEv = (ev: Event) => {
      const { url, x, y } = (ev as CustomEvent<any>).detail || {}
      if (!url) return
      setData({ url, x, y })
      setOpen(true)
    }
    window.addEventListener('paste-url-choice' as any, onEv as any)
    return () => window.removeEventListener('paste-url-choice' as any, onEv as any)
  }, [])

  useEffect(() => {
    if (!triggerRef.current || !data) return
    const el = triggerRef.current
    el.style.left = `${data.x}px`
    el.style.top = `${data.y + 18}px`
  }, [data])

  if (!data) return null

  const close = () => setOpen(false)
  const finalize = () => { close(); setTimeout(() => setData(null), 150) }

  // no helper; Mention/URL stay inline

  const insertPlain = () => {
    editor.chain().focus().insertContent(data.url + ' ').run()
    finalize()
  }
  const insertMention = () => {
    editor.chain().focus().insertContent({ type: 'linkMention', attrs: { href: data.url } }).insertContent(' ').run()
    finalize()
  }
  const insertBookmark = () => {
    const { state } = editor
    const $from = state.selection.$from
    const afterPos = $from.after($from.depth)
    // 1) Insert the bookmark as a block at the boundary
    editor.commands.insertContentAt(afterPos, { type: 'bookmark', attrs: { href: data.url } }, { updateSelection: false })
    // 2) Compute new doc and insert a paragraph after the bookmark, then focus it
    const nodeAfter = editor.state.doc.nodeAt(afterPos)
    const paraPos = afterPos + (nodeAfter?.nodeSize || 1)
    editor.commands.insertContentAt(paraPos, { type: 'paragraph' }, { updateSelection: true })
    editor.commands.focus()
    finalize()
  }

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (!v) finalize() }}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Paste URL menu anchor"
          className="absolute z-50 h-0 w-0 opacity-0 pointer-events-none"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="min-w-[180px]">
        <DropdownMenuLabel>Paste as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); insertMention() }}>Mention</DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); insertPlain() }}>URL</DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); insertBookmark() }}>Bookmark</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
