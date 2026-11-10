import { useEffect, useState } from 'react'

/**
 * True once the tab has been backgrounded while `watching`. A hidden tab has
 * throttled timers, so the result is flagged rather than silently trusted.
 */
export function useTabWasHidden(watching: boolean): boolean {
  const [wasHidden, setWasHidden] = useState(false)

  useEffect(() => {
    if (!watching) return
    const onVisibilityChange = () => {
      if (document.hidden) setWasHidden(true)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => { document.removeEventListener('visibilitychange', onVisibilityChange) }
  }, [watching])

  return wasHidden
}
