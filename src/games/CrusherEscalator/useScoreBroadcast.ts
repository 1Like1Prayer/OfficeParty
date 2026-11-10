import { useEffect, useRef } from 'react'
import { SELF_TIMED } from '../../shared/constants.ts'

const BROADCAST_INTERVAL_MS = 1000 / SELF_TIMED.PROGRESS_HZ

/**
 * Tells the other players our score, at most `PROGRESS_HZ` times a second. The
 * server drops reports that come faster than that, so a burst of presses is
 * collapsed into one report carrying the latest score rather than losing it.
 */
export function useScoreBroadcast(
  score: number,
  enabled: boolean,
  onProgress: (progress: unknown) => void,
): void {
  const lastSentAtMs = useRef(Number.NEGATIVE_INFINITY)

  useEffect(() => {
    if (!enabled) return

    const waitMs = Math.max(0, lastSentAtMs.current + BROADCAST_INTERVAL_MS - performance.now())
    const timer = setTimeout(() => {
      lastSentAtMs.current = performance.now()
      onProgress({ score })
    }, waitMs)

    return () => { clearTimeout(timer) }
  }, [score, enabled, onProgress])
}
