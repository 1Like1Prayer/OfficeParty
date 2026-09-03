import { useEffect, useState } from 'react'

/** Fast enough to blur, slow enough to read as numbers rather than noise. */
const FRAME_MS = 60

/**
 * The band the decoys run through, in whole seconds. Wider than the band the
 * server actually draws from, so the spin reads as a full range rolling past
 * rather than a short list cycling.
 */
const FIRST_DECOY_S = 1
const LAST_DECOY_S = 10

const pickDecoy = (): number =>
  (FIRST_DECOY_S + Math.floor(Math.random() * (LAST_DECOY_S - FIRST_DECOY_S + 1))) * 1000

/** Never show the same decoy twice running — a repeat reads as a freeze. */
function nextDecoy(current: number): number {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = pickDecoy()
    if (candidate !== current) return candidate
  }
  return current
}

/**
 * A decoy target that reshuffles while `spinning`, so the real one lands
 * rather than simply appearing.
 *
 * Seeded with a decoy rather than null: the real target must never be on
 * screen, not even for the first frame.
 */
export function useTargetSpin(spinning: boolean): number | null {
  const [decoy, setDecoy] = useState(pickDecoy)

  useEffect(() => {
    if (!spinning) return
    const timer = setInterval(() => { setDecoy(nextDecoy) }, FRAME_MS)
    return () => { clearInterval(timer) }
  }, [spinning])

  return spinning ? decoy : null
}
