import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Sun, MoonStar, Monitor } from 'lucide-react'

type Props = { trigger: React.ReactNode }

function applyTheme(theme: 'light' | 'dark' | 'system' | 'notion-light' | 'notion-dark') {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  } else if (theme === 'light' || theme === 'dark') {
    root.removeAttribute('data-theme')
    root.classList.toggle('dark', theme === 'dark')
  } else {
    root.classList.toggle('dark', false)
    root.setAttribute('data-theme', theme)
  }
}

export function SettingsDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system' | 'notion-light' | 'notion-dark'>(() => (localStorage.getItem('theme') as any) || 'system')

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const cb = () => applyTheme('system')
    media.addEventListener('change', cb)
    return () => media.removeEventListener('change', cb)
  }, [theme])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Preferences</div>
            <div className="text-sm">Appearance</div>
            <Separator className="my-2" />
            <div className="text-xs font-medium text-muted-foreground">Language & Time</div>
            <div className="text-sm">Language</div>
          </div>
          <div className="col-span-8 space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Appearance</div>
              <div className="flex items-center gap-2">
                <Button variant={theme === 'system' ? 'default' : 'outline'} onClick={() => setTheme('system')}>
                  <Monitor className="size-4 mr-2" /> System
                </Button>
                <Button variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')}>
                  <Sun className="size-4 mr-2" /> Light
                </Button>
                <Button variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')}>
                  <MoonStar className="size-4 mr-2" /> Dark
                </Button>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Presets</div>
              <div className="flex items-center gap-2">
                <Button variant={theme === 'notion-light' ? 'default' : 'outline'} onClick={() => setTheme('notion-light')}>Notion Light</Button>
                <Button variant={theme === 'notion-dark' ? 'default' : 'outline'} onClick={() => setTheme('notion-dark')}>Notion Dark</Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


