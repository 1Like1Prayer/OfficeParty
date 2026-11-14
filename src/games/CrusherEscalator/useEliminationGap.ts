import { useEffect, useState } from 'react'
import { eliminationGapAt, gapNarrowingTimes } from '../../shared/games/crusherEscalator/gap.ts'

/**
 * The elimination gap right now. It narrows at fixed points in the race (see
 * the shared `gap.ts`), so this re-renders at each of them: a narrower gap can
 * crush a player even when nobody presses anything.
 */
export function useEliminationGap(isRacing: boolean, timingStartsAtLocalMs: number): number {
  const elapsedMs = (): number => Math.max(0, performance.now() - timingStartsAtLocalMs)
  const [gap, setGap] = useState(() => eliminationGapAt(isRacing ? elapsedMs() : 0))

  useEffect(() => {
    if (!isRacing) return
    const update = () => { setGap(eliminationGapAt(elapsedMs())) }
    update()
    const timers = gapNarrowingTimes().map((atMs) =>
      setTimeout(update, Math.max(0, timingStartsAtLocalMs + atMs - performance.now())),
    )
    return () => { timers.forEach(clearTimeout) }
    // `elapsedMs` only reads `timingStartsAtLocalMs`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRacing, timingStartsAtLocalMs])

  return gap
}
