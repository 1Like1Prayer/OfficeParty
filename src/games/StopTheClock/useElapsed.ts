import { useEffect, useState } from 'react'

/**
 * Milliseconds since the clock started, re-read every frame. This is the same
 * measurement the result is taken from, so what the player sees is what they
 * are about to report.
 */
export function useElapsed(fromLocalMs: number, running: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!running) return

    let frame = requestAnimationFrame(function tick() {
      setElapsedMs(Math.max(0, performance.now() - fromLocalMs))
      frame = requestAnimationFrame(tick)
    })

    return () => { cancelAnimationFrame(frame) }
  }, [running, fromLocalMs])

  return elapsedMs
}
