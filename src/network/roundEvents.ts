/**
 * What the server's one-off messages mean for the screen. Each handler takes
 * the current events and returns the next, so the rules for "what a new
 * round clears" live in one readable place. Pure, apart from reading the
 * local clock when a message arrives.
 */

import type {
  LeaderboardPayload,
  RoundClosingPayload,
  RoundDataPayload,
  RoundResultsPayload,
} from '../shared/protocol.ts'
import type { NextStageView } from '../types/index.ts'

export interface RoundEvents {
  /** Public data for the attempt being played (the target, the scenes, the map…). */
  roundData: RoundDataPayload | null
  results: RoundResultsPayload | null
  /**
   * Set once the server has decided the running round and is waiting only on
   * the players it lists: they must stop and report now.
   */
  closing: RoundClosingPayload | null
  /**
   * Set when the round that just resolved goes on to another stage, and kept
   * through the next stage's set-up until that stage resolves in turn.
   */
  nextStage: NextStageView | null
  /** `performance.now()` value the game's ending animation runs until, if it has one. */
  finishAnimationEndsAtLocalMs: number | null
  leaderboard: LeaderboardPayload | null
}

export const NO_ROUND_EVENTS: RoundEvents = {
  roundData: null,
  results: null,
  closing: null,
  nextStage: null,
  finishAnimationEndsAtLocalMs: null,
  leaderboard: null,
}

/**
 * A new round starts from scratch, whatever the last one ended on. The host
 * can skip a game mid-round or mid-ending, so nothing of it may linger.
 */
export const onGameStarting = (events: RoundEvents): RoundEvents => ({
  ...NO_ROUND_EVENTS,
  leaderboard: events.leaderboard,
})

/** A new attempt's data: the last attempt's results and closing notice are over. */
export const onRoundData = (events: RoundEvents, payload: RoundDataPayload): RoundEvents => ({
  ...events,
  roundData: payload,
  results: null,
  closing: null,
  finishAnimationEndsAtLocalMs: null,
})

export const onRoundClosing = (
  events: RoundEvents,
  payload: RoundClosingPayload,
): RoundEvents => ({ ...events, closing: payload })

export const onRoundResults = (
  events: RoundEvents,
  payload: RoundResultsPayload,
  localNowMs: number,
): RoundEvents => ({
  ...events,
  results: payload,
  nextStage:
    payload.advancing === null
      ? null
      : { playerIds: payload.advancing, pauseMs: payload.stageBreakMs },
  // Measured from arrival: the server holds the next round back for this
  // long, so the animation and its wait start together.
  finishAnimationEndsAtLocalMs:
    payload.finishAnimationMs > 0 ? localNowMs + payload.finishAnimationMs : null,
})

export const onLeaderboard = (
  events: RoundEvents,
  payload: LeaderboardPayload,
): RoundEvents => ({ ...events, leaderboard: payload })

/** Back in the lobby, or off the leaderboard: nothing from the last match is shown. */
export const onLeftLeaderboard = (events: RoundEvents): RoundEvents =>
  events.leaderboard === null ? events : { ...events, leaderboard: null }
