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

/**
 * Which beat of a count-in is showing, latest first: 3, 2, 1.
 *
 * The beat is a share of the window rather than a literal second, so a calmer
 * count is a longer window — the numbers still read 3, 2, 1, they just hold
 * for longer each.
 */
export function beatsRemaining(
  msLeft: number | null,
  windowMs: number,
  beats: number,
): number | null {
  if (msLeft === null || msLeft > windowMs) return null
  const beat = windowMs / beats
  return Math.min(beats, Math.max(1, Math.ceil(msLeft / beat)))
}
