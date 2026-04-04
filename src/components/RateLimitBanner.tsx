import { usePageCreationLimit, usePageCreationCountdown } from '@/hooks/use-page-creation-limit'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RateLimitBannerProps {
  className?: string
}

export function RateLimitBanner({ className }: RateLimitBannerProps) {
  const blocked = usePageCreationLimit((s) => s.blocked)
  const remainingTime = usePageCreationLimit((s) => s.remainingTime)
  
  // Ensure the countdown runs in whatever view this is mounted
  usePageCreationCountdown()

  if (!blocked) return null

  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4 mt-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-300", className)}>
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs font-medium text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        <span>Page creation is temporarily blocked. Please try again in <span className="font-bold tabular-nums">{remainingTime}s</span>.</span>
      </div>
    </div>
  )
}
