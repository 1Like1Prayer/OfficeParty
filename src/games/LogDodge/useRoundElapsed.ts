import { useEffect, useState } from 'react'

/** Before the first reading, the round is a long way off. */
const NOT_STARTED_MS = -1_000_000
/** How often the clock is read even when the page is not being drawn. */
const BACKGROUND_TICK_MS = 250

/**
 * Milliseconds into the round, negative before it starts, read against the
 * same clock the player's presses are timed by.
 *
 * It is read every frame while the page is being drawn, and also on a timer.
 * The timer matters: a tab that is not in front stops getting animation
 * frames, and a clock that waited for them would stop with it — the player's
 * hits would never be judged, so they would neither be knocked out nor be
 * reported to anyone else, however many logs went through them. Browsers slow
 * a hidden tab's timers to about a second, which is plenty to judge from.
 */
export function useRoundElapsed(startsAtLocalMs: number, durationMs: number): number {
  const [elapsedMs, setElapsedMs] = useState(NOT_STARTED_MS)

  useEffect(() => {
    const read = () => { setElapsedMs(Math.min(durationMs, performance.now() - startsAtLocalMs)) }

    let frame = requestAnimationFrame(function tick() {
      read()
      frame = requestAnimationFrame(tick)
    })
    const timer = setInterval(read, BACKGROUND_TICK_MS)

    return () => {
      cancelAnimationFrame(frame)
      clearInterval(timer)
    }
  }, [startsAtLocalMs, durationMs])

  return elapsedMs
}
