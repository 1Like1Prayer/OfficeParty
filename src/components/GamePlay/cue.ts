import { beatsRemaining } from '../../hooks/index.ts'

/**
 * The tail of the round's countdown window, reserved for the start cue. The
 * game's own build-up gets whatever is left — so lengthening COUNTDOWN_MS on
 * the server lengthens the build-up, not the cue.
 */
export const ROUND_CUE_MS = 3_600

/** Latest first: index by how many beats are left. */
export const CUES = ['START!', 'SET', 'GET READY'] as const

/** How many beats remain, or null while the game is still building up. */
export function cueFrom(msToPlay: number | null): number | null {
  return beatsRemaining(msToPlay, ROUND_CUE_MS, CUES.length)
}
