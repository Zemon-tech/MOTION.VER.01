import { create } from 'zustand'
import { useEffect } from 'react'

interface PageCreationLimitState {
  blocked: boolean
  retryDeadline: number | null
  remainingTime: number // seconds
  setBlocked: (retryAfterMs: number) => void
  updateRemainingTime: () => void
  reset: () => void
}

export const usePageCreationLimit = create<PageCreationLimitState>((set, get) => ({
  blocked: false,
  retryDeadline: null,
  remainingTime: 0,
  setBlocked: (retryAfterMs: number) => {
    const deadline = Date.now() + retryAfterMs
    set({
      blocked: true,
      retryDeadline: deadline,
      remainingTime: Math.ceil(retryAfterMs / 1000),
    })
  },
  updateRemainingTime: () => {
    const { retryDeadline } = get()
    if (!retryDeadline) return

    const now = Date.now()
    if (now >= retryDeadline) {
      set({ blocked: false, retryDeadline: null, remainingTime: 0 })
    } else {
      set({ remainingTime: Math.ceil((retryDeadline - now) / 1000) })
    }
  },
  reset: () => set({ blocked: false, retryDeadline: null, remainingTime: 0 }),
}))

/**
 * Hook to automatically update the countdown when blocked.
 * Should be called in a relevant component (e.g., Sidebar or App).
 */
export function usePageCreationCountdown() {
  const blocked = usePageCreationLimit((state) => state.blocked)
  const updateRemainingTime = usePageCreationLimit((state) => state.updateRemainingTime)

  useEffect(() => {
    if (!blocked) return

    const interval = setInterval(() => {
      updateRemainingTime()
    }, 1000)

    return () => clearInterval(interval)
  }, [blocked, updateRemainingTime])
}
