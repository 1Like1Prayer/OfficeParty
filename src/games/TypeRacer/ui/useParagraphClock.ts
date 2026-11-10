import { useEffect, useState } from 'react'

/**
 * Whole seconds left until `deadlineLocalMs`, updated four times a second, or
 * null while the clock is not running. Only the display: the player's own
 * paragraph timer is what actually ends their race.
 */
export function useParagraphClock(deadlineLocalMs: number, running: boolean): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!running) return
    const tick = () => { setSecondsLeft(Math.max(0, Math.ceil((deadlineLocalMs - performance.now()) / 1000))) }
    tick()
    const timer = setInterval(tick, 250)
    return () => { clearInterval(timer) }
  }, [deadlineLocalMs, running])

  return running ? secondsLeft : null
}
