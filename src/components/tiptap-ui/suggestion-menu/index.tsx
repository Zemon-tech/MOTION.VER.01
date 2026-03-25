import * as React from "react"

type SuggestionItem = {
  title: string
  subtext?: string
  onSelect: (ctx: { editor: any }) => void
  aliases?: string[]
}

type SuggestionMenuProps = {
  char: string
  items: (args: { query: string; editor: any }) => SuggestionItem[]
  editor: any
}

export function SuggestionMenu({ char, items, editor }: SuggestionMenuProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)
  const triggerRangeRef = React.useRef<{ from: number; to: number } | null>(null)

  React.useEffect(() => {
    if (!editor) return
    const computeAndSetPosition = () => {
      const state = editor.state
      const from = state.selection.from
      const textBefore = state.doc.textBetween(Math.max(0, from - 100), from)
      // Match "/query" at end of the text before the cursor (no spaces in query)
      const match = new RegExp(`${char}([^\s]*)$`).exec(textBefore)
      if (match) {
        setOpen(true)
        setQuery(match[1] || "")
        // Anchor menu to the slash character position, not the caret end
        const slashLength = match[0].length
        const slashStart = from - slashLength
        const slashPos = slashStart + 1 // position right after '/'
        // store trigger range so we can delete it on selection
        triggerRangeRef.current = { from: slashStart, to: from }
        const coords = editor.view.coordsAtPos(Math.max(1, slashPos))
        const containerRect = (editor.view.dom as HTMLElement).getBoundingClientRect()
        const left = coords.left - containerRect.left
        const top = coords.bottom - containerRect.top + 4 // small offset
        setPos({ x: left, y: top })
      } else {
        setOpen(false)
        setQuery("")
        setPos(null)
        triggerRangeRef.current = null
      }
    }
    const onUpdate = () => computeAndSetPosition()
    editor.on("selectionUpdate", onUpdate)
    editor.on("transaction", onUpdate)
    window.addEventListener('resize', onUpdate)
    window.addEventListener('scroll', onUpdate, true)
    const onKeydown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery("")
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => {
      editor.off("selectionUpdate", onUpdate)
      editor.off("transaction", onUpdate)
      window.removeEventListener('resize', onUpdate)
      window.removeEventListener('scroll', onUpdate, true)
      window.removeEventListener('keydown', onKeydown)
    }
  }, [editor, char])

  if (!open || !pos) return null

  const list = items({ query, editor })
  if (!list.length) return null

  return (
    <div style={{ position: 'absolute', left: pos.x ?? 0, top: pos.y ?? 0, zIndex: 50 }} className="rounded-md border bg-card text-card-foreground shadow w-64 max-h-64 overflow-auto">
      <ul className="m-0 p-1 text-sm">
        {list.map((item, i) => (
          <li key={i}>
            <button className="w-full text-left px-3 py-2 hover:bg-accent rounded" onMouseDown={(e) => {
              e.preventDefault()
              // remove the trigger text '/query' before running the action
              const range = triggerRangeRef.current
              if (range) {
                editor.chain().focus().deleteRange(range).run()
              }
              item.onSelect({ editor })
              // close menu after selection
              setOpen(false)
              setQuery("")
              triggerRangeRef.current = null
            }}>
              <div className="font-medium">{item.title}</div>
              {item.subtext ? <div className="text-xs text-muted-foreground">{item.subtext}</div> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}


