import type { ReactNode } from 'react'
import type { RankedEntry } from '../shared/games/selfTimed.ts'
import type { NextStageView, RoundPlayerView } from '../types/index.ts'

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
  /** Everyone taking part in this round, for games that show the other players. */
  players: RoundPlayerView[]
  /** This player's own id; always one of `players`. */
  selfPlayerId: string
  /**
   * What the other players are reporting through `onProgress`, keyed by player
   * id. Display only, and it lags by a few hundred milliseconds.
   */
  progress: Record<string, Record<string, number>>
  /**
   * Changes whenever a fresh attempt begins — a new round, a tiebreaker, the
   * next stage — while this surface stays mounted. Anything a game keeps for
   * one attempt starts over when it changes.
   */
  attemptKey: string
  /**
   * Set while the round pauses between stages: who goes through to the next
   * stage, best first. Games with stages use it to show the changeover.
   */
  nextStage: NextStageView | null
  /**
   * The server's final ranking, once the round is decided and while the game
   * plays its ending animation; null until then. Play the outcome from this
   * rather than from what the screen worked out for itself.
   */
  finalRanking: RankedEntry[] | null
  /** True once this player's result is in; the surface should lock. */
  submitted: boolean
  /** Report a result. The server validates it; the client never scores. */
  onSubmit: (result: unknown) => void
  /** Display-only signal for the other players' screens. */
  onProgress: (progress: unknown) => void
  /**
   * Ask the server something mid-round that only it can answer, such as the
   * outcome of a dice roll. Resolves with its reply; rejects if it refuses.
   */
  onAction: (action: unknown) => Promise<unknown>
}

export type GameSurface = (props: GameSurfaceProps) => ReactNode
