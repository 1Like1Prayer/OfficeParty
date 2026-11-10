import { useEffect, useRef } from 'react'
import { SELF_TIMED } from '../shared/constants.ts'

const REPORT_INTERVAL_MS = 1000 / SELF_TIMED.PROGRESS_HZ

/**
 * Tells the other players where this player is, at most `PROGRESS_HZ` times a
 * second. The server drops reports that come faster than that, so a burst of
 * changes is collapsed into one report carrying the latest value rather than
 * losing it. Only a changed value is sent.
 */
export function useThrottledReport(
  value: unknown,
  enabled: boolean,
  report: (value: unknown) => void,
): void {
  const lastSentAtMs = useRef(Number.NEGATIVE_INFINITY)
  const lastSent = useRef<string | null>(null)
  const serialized = JSON.stringify(value)

  useEffect(() => {
    if (!enabled || serialized === lastSent.current) return

    const waitMs = Math.max(0, lastSentAtMs.current + REPORT_INTERVAL_MS - performance.now())
    const timer = setTimeout(() => {
      lastSentAtMs.current = performance.now()
      lastSent.current = serialized
      report(JSON.parse(serialized) as unknown)
    }, waitMs)

    return () => { clearTimeout(timer) }
  }, [serialized, enabled, report])
}
