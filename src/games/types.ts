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
   * Where the round is. A surface is mounted from `starting` so it can build
   * up to the round — reveal a target, deal a hand — and only takes input at
   * `playing`.
   */
  phase: 'starting' | 'countdown' | 'playing'
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
