import { useEffect, useState } from 'react'

/**
 * How far through the pause between paragraphs we are, 0 to 1, redrawn every
 * frame so a loading bar fills smoothly. `onDone` is called once, as it ends.
 * Null while there is no pause.
 */
export function useParagraphBreak({
  isBreak,
  startsAtLocalMs,
  durationMs,
  onDone,
}: {
  isBreak: boolean
  startsAtLocalMs: number
  durationMs: number
  onDone: () => void
}): number | null {
  // Remembered with the pause it belongs to, so a new pause never starts from the last one's end.
  const [measured, setMeasured] = useState({ startsAtLocalMs: Number.NaN, progress: 0 })

  useEffect(() => {
    if (!isBreak) return
    let frame = 0
    const tick = () => {
      const progress = Math.min(1, Math.max(0, (performance.now() - startsAtLocalMs) / durationMs))
      setMeasured({ startsAtLocalMs, progress })
      if (progress >= 1) onDone()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame) }
  }, [isBreak, startsAtLocalMs, durationMs, onDone])

  if (!isBreak) return null
  return measured.startsAtLocalMs === startsAtLocalMs ? measured.progress : 0
}
