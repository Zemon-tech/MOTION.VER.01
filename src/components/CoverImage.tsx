import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type CoverImageProps = {
  url?: string | null
  position?: number // 0-100 (percentage from top)
  readOnly?: boolean
  onUrlChange?: (url: string | null) => void
  onPositionChange?: (position: number) => void
  height?: number // px
}

export function CoverImage({ url, position = 50, readOnly = false, onUrlChange, onPositionChange, height = 280 }: CoverImageProps) {
  const [dragging, setDragging] = React.useState(false)
  const startYRef = React.useRef(0)
  const startPosRef = React.useRef(position)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const dy = e.clientY - startYRef.current
      const deltaPct = (dy / height) * 100
      let next = Math.max(0, Math.min(100, startPosRef.current - deltaPct))
      onPositionChange?.(Math.round(next))
    }
    const onUp = () => {
      setDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragging, height, onPositionChange])

  function startDrag(e: React.MouseEvent) {
    if (readOnly || !url) return
    setDragging(true)
    startYRef.current = e.clientY
    startPosRef.current = position
  }

  const [open, setOpen] = React.useState(false)
  function changeUrl() {
    if (readOnly) return
    setOpen(true)
  }
  function removeUrl() {
    if (readOnly) return
    onUrlChange?.(null)
  }

  if (!url) return null

  return (
    <div className="w-full" ref={containerRef}>
      <div className="group relative w-full overflow-hidden" style={{ height }}>
        <div
          className={`w-full h-full bg-center bg-no-repeat bg-cover select-none ${dragging ? 'cursor-grabbing' : readOnly ? '' : 'cursor-grab'}`}
          style={{
            backgroundImage: `url(${url})`,
            backgroundPosition: `center ${position}%`,
          }}
          onMouseDown={startDrag}
          aria-label="Cover image"
        />

        {!readOnly ? (
          <div className="absolute right-3 bottom-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="px-2 py-1 rounded bg-background/80 border text-xs shadow-sm hover:bg-background"
              onClick={changeUrl}
            >
              Change cover
            </button>
            <button
              className="px-2 py-1 rounded bg-background/80 border text-xs shadow-sm hover:bg-background text-red-500"
              onClick={removeUrl}
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
      <CoverPickerDialog
        open={open}
        onOpenChange={setOpen}
        currentUrl={url || null}
        onSelect={(u) => { onUrlChange?.(u); setOpen(false) }}
      />
    </div>
  )
}

export function CoverPickerDialog({ open, onOpenChange, currentUrl, onSelect, predefinedUrls }: { open: boolean; onOpenChange: (v: boolean) => void; currentUrl: string | null; onSelect: (u: string | null) => void; predefinedUrls?: string[] }) {
  const [tab, setTab] = React.useState<'gallery' | 'link'>('gallery')
  const [val, setVal] = React.useState(currentUrl || '')
  React.useEffect(() => { setVal(currentUrl || '') }, [currentUrl, open])
  const defaultGallery = React.useMemo<string[]>(() => [
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1503264116251-35a269479413?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=1200&auto=format&fit=crop',
    'https://www.notion.so/images/page-cover/nasa_space_shuttle_challenger.jpg',
    'https://www.notion.so/images/page-cover/rijksmuseum_jansz_1641.jpg',
    'https://www.notion.so/images/page-cover/nasa_reduced_gravity_walking_simulator.jpg',
    'https://www.notion.so/images/page-cover/nasa_earth_grid.jpg',
    'https://www.notion.so/images/page-cover/nasa_fingerprints_of_water_on_the_sand.jpg',
    'https://www.notion.so/images/page-cover/nasa_robert_stewart_spacewalk_2.jpg',
    'https://www.notion.so/images/page-cover/rijksmuseum_jansz_1649.jpg',
    'https://www.notion.so/images/page-cover/rijksmuseum_rembrandt_1642.jpg',
    'https://www.notion.so/images/page-cover/rijksmuseum_vermeer_the_milkmaid.jpg',
    
  ], [])
  const gallery = React.useMemo<string[]>(() => {
    const base = predefinedUrls && predefinedUrls.length ? predefinedUrls : defaultGallery
    const list = base.slice()
    if (currentUrl && !list.includes(currentUrl)) list.unshift(currentUrl)
    return list
  }, [predefinedUrls, defaultGallery, currentUrl])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-2xl" aria-describedby={undefined} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Set cover image</span>
            <button className="text-xs underline text-muted-foreground hover:text-foreground" onClick={() => { onSelect(null) }}>Remove</button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
          <div className="flex border-b">
            <button className={`px-3 py-2 text-sm ${tab==='gallery' ? 'border-b-2 border-foreground' : 'text-muted-foreground'}`} onClick={() => setTab('gallery')}>Gallery</button>
            <button className={`px-3 py-2 text-sm ${tab==='link' ? 'border-b-2 border-foreground' : 'text-muted-foreground'}`} onClick={() => setTab('link')}>Link</button>
          </div>
          {tab === 'gallery' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gallery.map((g, i) => (
                <button key={i} className="aspect-[4/2] rounded border overflow-hidden bg-center bg-cover" style={{ backgroundImage: `url(${g})` }} onClick={() => { onSelect(g) }} />
              ))}
            </div>
          ) : (
            <>
              <input
                className="w-full border rounded px-2 py-1 text-sm bg-background"
                placeholder="https://example.com/image.jpg"
                value={val}
                onChange={(e) => setVal(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1 text-sm border rounded" onClick={() => onOpenChange(false)}>Cancel</button>
                <button className="px-3 py-1 text-sm border rounded bg-foreground text-background" onClick={() => { onSelect(val.trim() || null); onOpenChange(false) }}>Save</button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
