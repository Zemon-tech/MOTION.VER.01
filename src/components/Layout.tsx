import type { ReactNode } from 'react'
import { SidebarProvider, Sidebar as ShadSidebar, SidebarInset } from '@/components/ui/sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CommandPalette } from '@/components/CommandPalette'

type LayoutProps = {
  header: ReactNode
  sidebar: ReactNode
  children: ReactNode
  hideSidebar?: boolean
  hideHeader?: boolean
}

export function Layout({ header, sidebar, children, hideSidebar = false, hideHeader = false }: LayoutProps) {
  if (hideSidebar) {
    return (
      <div className="flex h-svh w-svw bg-background text-foreground">
        <CommandPalette />
        <div className="flex min-h-svh flex-col w-full">
          {hideHeader ? null : (
            <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="w-full h-10 flex items-center px-0">
                {header}
              </div>
            </header>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <main className="w-full h-full px-0">
              {children}
            </main>
          </div>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex h-svh w-svw bg-background text-foreground">
        <CommandPalette />
        <ShadSidebar>
          <ScrollArea className="h-full w-full">
            {sidebar}
          </ScrollArea>
        </ShadSidebar>
        <SidebarInset className="flex min-h-svh flex-col">
          {hideHeader ? null : (
            <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="w-full h-10 flex items-center px-0">
                {header}
              </div>
            </header>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <main className="w-full h-full px-0">
              {children}
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
