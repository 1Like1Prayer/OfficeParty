import { useEffect, useState } from 'react'
import { pickTargetMs } from '../../shared/games/stopTheClock.ts'

/** Fast enough to blur, slow enough to read as numbers rather than noise. */
const FRAME_MS = 60

/** Never show the same decoy twice running — a repeat reads as a freeze. */
function nextDecoy(current: number): number {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = pickTargetMs()
    if (candidate !== current) return candidate
  }
  return current
}

/**
 * A decoy target that reshuffles while `spinning`, so the real one lands
 * rather than simply appearing. The values come from the same picker the
 * server uses, so the spin ranges over exactly the numbers it could have been
 * — which is why this must be re-copied whenever the game module changes.
 *
 * Seeded with a decoy rather than null: the real target must never be on
 * screen, not even for the first frame.
 */
export function useTargetSpin(spinning: boolean): number | null {
  const [decoy, setDecoy] = useState(pickTargetMs)

  useEffect(() => {
    if (!spinning) return
    const timer = setInterval(() => { setDecoy(nextDecoy) }, FRAME_MS)
    return () => { clearInterval(timer) }
  }, [spinning])

  return spinning ? decoy : null
}
