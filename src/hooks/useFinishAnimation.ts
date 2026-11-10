import { useMemo } from 'react'
import { useCountdown } from './useCountdown.ts'

/**
 * True while a game's ending animation is still playing: from the moment the
 * round is decided until `endsAtLocalMs`. Null means the game has no ending
 * animation, so this is never true.
 *
 * Stays true until the first frame has measured the time left, so a game with
 * an animation never flashes the results screen for a frame before it starts.
 */
export function useFinishAnimation(endsAtLocalMs: number | null): boolean {
  const msLeft = useMemo(
    () => (endsAtLocalMs === null ? null : () => endsAtLocalMs - performance.now()),
    [endsAtLocalMs],
  )
  const remainingMs = useCountdown(msLeft)

  return endsAtLocalMs !== null && (remainingMs === null || remainingMs > 0)
}
