import { useEffect, useState } from 'react'

/**
 * Milliseconds left until `msLeft()` reaches zero, re-read every frame so the
 * number on screen matches the clock the round is actually run against. Null
 * when there is nothing to count down to.
 */
export function useCountdown(msLeft: (() => number) | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!msLeft) return

    let frame = requestAnimationFrame(function tick() {
      setRemaining(Math.max(0, msLeft()))
      frame = requestAnimationFrame(tick)
    })

    return () => { cancelAnimationFrame(frame) }
  }, [msLeft])

  // Ignore the last countdown's value while there is no new one to show.
  return msLeft ? remaining : null
}
