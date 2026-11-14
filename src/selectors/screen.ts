import type { RoomView, RoundView } from '../network/index.ts'
import type { RoundResultsPayload } from '../shared/protocol.ts'
import type { NextStageView } from '../types/index.ts'
import { selectGameScreenIsUp } from './round.ts'

/**
 * Which whole screen the player is looking at. A change of screen is what the
 * transition plays for; anything that changes inside a screen — a ready check
 * filling up, a heat becoming the final — is not one.
 */
export type ScreenKey =
  | 'title'
  | 'host'
  | 'join'
  | 'lobby'
  /** A game being introduced: rules, ready check, the run-up to the start. */
  | 'game-intro'
  /** The game itself, from its countdown to the end of its ending animation. */
  | 'game'
  | 'results'
  | 'standings'

export function selectScreenKey({
  stage,
  room,
  round,
  results,
  isParticipant,
  isFinishing,
  nextStage,
}: {
  stage: 'title' | 'host' | 'join' | 'room'
  room: RoomView | null
  round: RoundView
  results: RoundResultsPayload | null
  isParticipant: boolean
  isFinishing: boolean
  nextStage: NextStageView | null
}): ScreenKey {
  if (stage !== 'room') return stage
  if (room === null || room.phase === 'lobby') return 'lobby'
  if (room.phase === 'leaderboard') return 'standings'
  if (selectGameScreenIsUp({ round, results, isParticipant, isFinishing, nextStage })) return 'game'
  return round.phase === 'results' ? 'results' : 'game-intro'
}
