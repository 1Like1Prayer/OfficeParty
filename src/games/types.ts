import type { ReactNode } from 'react'

/**
 * What a playable game gets from the round and how it reports back.
 *
 * A game never sees the clock the server keeps: it is handed the local time
 * its round starts at, measures its own player with `performance.now()`, and
 * hands back whatever its module on the server knows how to parse.
 */
export interface GameSurfaceProps {
  /**
   * Where the round is.
   *
   * `building` is the game's own run-up — reveal a target, deal a hand. By
   * `cueing` that has to be settled and final, because the round is counting
   * the player in and they are reading it. Input opens at `playing`.
   */
  phase: 'building' | 'cueing' | 'playing'
  /** Public round data, exactly as `round:data` delivered it. */
  data: unknown
  /** `performance.now()` value the clock starts at. */
  timingStartsAtLocalMs: number
  /** True once this player's result is in; the surface should lock. */
  submitted: boolean
  /** Report a result. The server validates it; the client never scores. */
  onSubmit: (result: unknown) => void
  /** Display-only signal for the other players' screens. */
  onProgress: (progress: unknown) => void
}

export type GameSurface = (props: GameSurfaceProps) => ReactNode
