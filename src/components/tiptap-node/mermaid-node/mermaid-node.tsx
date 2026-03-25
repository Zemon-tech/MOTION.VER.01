import * as React from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Code2, Eye, Columns } from "lucide-react"
 
const useMermaid = () => {
  const ref = React.useRef<any | null>(null)
  const readyRef = React.useRef<Promise<void> | null>(null)

  const ensure = React.useCallback(() => {
    if (typeof window === "undefined") return Promise.resolve()
    if (readyRef.current) return readyRef.current
    readyRef.current = (async () => {
      const mod = await import("mermaid")
      const m = (mod as any)?.default ?? mod
      m.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default",
      })
      ref.current = m
    })()
    return readyRef.current
  }, [])

  return { get: () => ref.current, ensure }
}

export function MermaidNode(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props
  const code: string = node.attrs.code || ""
  const mode: "code" | "preview" | "split" = node.attrs.mode || "split"
  const isEditable = (props as any)?.editor?.isEditable ?? true
  const effectiveMode: "code" | "preview" | "split" = isEditable ? mode : "preview"

  const [renderKey, setRenderKey] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const svgContainerRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const mermaid = useMermaid()

  const doRender = React.useCallback(async () => {
    setError(null)
    try {
      await mermaid.ensure()
      if ((document as any).fonts && typeof (document as any).fonts.ready?.then === "function") {
        try { await (document as any).fonts.ready } catch {}
      }
      const m = mermaid.get()
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const { svg } = await m.render(id, code)
      if (svgContainerRef.current) {
        svgContainerRef.current.innerHTML = svg
        const svgEl = svgContainerRef.current.querySelector('svg') as SVGSVGElement | null
        if (svgEl) {
          svgEl.style.maxWidth = '100%'
          svgEl.style.height = 'auto'
          svgEl.setAttribute('preserveAspectRatio', svgEl.getAttribute('preserveAspectRatio') || 'xMidYMid meet')
          if (!svgEl.getAttribute('viewBox')) {
            const w = parseFloat(svgEl.getAttribute('width') || '0')
            const h = parseFloat(svgEl.getAttribute('height') || '0')
            if (w > 0 && h > 0) {
              svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`)
            }
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to render diagram")
    }
  }, [code, mermaid])

  React.useEffect(() => {
    if (effectiveMode !== "code") {
      void doRender()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey, effectiveMode])

  const onChangeCode = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateAttributes({ code: e.target.value })
  }

  const setMode = (m: "code" | "preview" | "split") => {
    if (!isEditable) return
    updateAttributes({ mode: m })
  }

  const toolbar = isEditable ? (
    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 data-[selected=true]:opacity-100" data-selected={selected}>
      <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="bg-background/50 hover:bg-background/70 border border-border/50">
                  {effectiveMode === "code" ? <Code2 className="size-4" /> : effectiveMode === "preview" ? <Eye className="size-4" /> : <Columns className="size-4" />}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>View</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuLabel>View</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setMode("code")}>
              <Code2 className="mr-2 size-4" /> Code
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMode("preview")}>
              <Eye className="mr-2 size-4" /> Preview
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMode("split")}>
              <Columns className="mr-2 size-4" /> Split
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="default" className="h-8 px-3" onClick={() => setRenderKey((k) => k + 1)} aria-label="Render diagram">
              Render
            </Button>
          </TooltipTrigger>
          <TooltipContent>Render diagram</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  ) : null

  return (
    <NodeViewWrapper as="div" className={cn("group relative my-4 rounded-md border bg-muted/20 overflow-hidden", selected && "ring-2 ring-ring")}
      data-mode={mode}
    >
      {toolbar}
      <div className={cn("grid", effectiveMode === "split" ? "md:grid-cols-2" : "grid-cols-1")}
      >
        {isEditable && (effectiveMode === "code" || effectiveMode === "split") && (
          <div className="p-3 border-r bg-background">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={onChangeCode}
              className="w-full min-h-[140px] font-mono text-sm bg-transparent outline-none resize-y"
              placeholder={"graph TD\n  A[Mermaid] --> B[Diagram]"}
            />
          </div>
        )}
        {(effectiveMode === "preview" || effectiveMode === "split") && (
          <div className="p-3">
            <div className="w-full overflow-auto flex justify-center">
              <div ref={svgContainerRef} className="inline-block" />
            </div>
            {error ? (
              <div className="mt-2 text-sm text-destructive">{error}</div>
            ) : null}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default MermaidNode
