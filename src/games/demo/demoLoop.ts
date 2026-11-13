import { useEffect, useState } from 'react'

/** Time into a loop of `loopMs`, in ms. Every frame derives from it, so the demo never drifts. */
export function useLoopTime(loopMs: number): number {
  const [time, setTime] = useState(0)

  useEffect(() => {
    let frame = 0
    const startedAt = performance.now()
    const tick = (now: number) => {
      setTime((now - startedAt) % loopMs)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame) }
  }, [loopMs])

  return time
}

/**
 * Which step `t` falls in, given each step's start time (the first is 0), and
 * how far through that step it is, 0–1.
 */
export function stepAt(t: number, starts: readonly number[], loopMs: number): { step: number; progress: number } {
  let step = 0
  while (step + 1 < starts.length && t >= starts[step + 1]!) step += 1
  const start = starts[step]!
  const end = starts[step + 1] ?? loopMs
  return { step, progress: (t - start) / (end - start) }
}
