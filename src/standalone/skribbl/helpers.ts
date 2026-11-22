import { useMemo } from 'react'
import { useCountdown } from '../../hooks/index.ts'
import type { SkribblConnection, SkribblPlayerView } from '../../network/skribblConnection.ts'
import { swatches } from '../../theme/index.ts'

/** A player's color tile, the same on every screen: by join order. */
export const swatchFor = (player: SkribblPlayerView): string =>
  swatches[(player.joinOrder - 1 + swatches.length) % swatches.length]!

/** Seconds left in the turn's current phase, from the server's deadline. */
export function useSecondsLeft(game: SkribblConnection, endsAtServerMs: number | null): number | null {
  const local = endsAtServerMs === null ? null : game.toLocalMs(endsAtServerMs)
  // Rounded, so the clock estimate easing by a fraction doesn't restart the countdown every frame.
  const endsAtLocalMs = local === null ? null : Math.round(local / 50) * 50
  const msLeft = useMemo(
    () => (endsAtLocalMs === null ? null : () => endsAtLocalMs - performance.now()),
    [endsAtLocalMs],
  )
  const ms = useCountdown(msLeft)
  return ms === null ? null : Math.ceil(ms / 1000)
}
