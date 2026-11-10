import { useState } from 'react'
import { isCrushed } from './standings.ts'

interface Latch {
  attemptKey: string
  fallen: ReadonlySet<string>
}

/**
 * Who has been swallowed so far in this attempt. Once a player falls they stay
 * fallen: a late progress report must never pull someone back out of the black
 * hole. A new attempt starts everyone afresh.
 */
export function useFallenPlayers(
  gaps: Record<string, number>,
  attemptKey: string,
): ReadonlySet<string> {
  const [latch, setLatch] = useState<Latch>({ attemptKey, fallen: new Set() })
  const fallen = latch.attemptKey === attemptKey ? latch.fallen : new Set<string>()

  const newlyCrushed = Object.entries(gaps)
    .filter(([playerId, gap]) => !fallen.has(playerId) && isCrushed(gap))
    .map(([playerId]) => playerId)
  // Adjusting state while rendering is the supported way to derive a latch.
  if (latch.attemptKey !== attemptKey || newlyCrushed.length > 0) {
    setLatch({ attemptKey, fallen: new Set([...fallen, ...newlyCrushed]) })
  }

  return fallen
}
