import { ACTIONS, LOG_DODGE } from '../../shared/games/logDodge/constants.ts'
import type { Action } from '../../shared/games/logDodge/types.ts'
import type { RankedEntry } from '../../shared/games/selfTimed.ts'
import type { RoundPlayerView } from '../../types/index.ts'
import type { ContestantStatus } from './scene/LogDodgeScene.ts'

/**
 * How everyone is doing, for the stage to draw. The player's own hits come
 * from judging their own presses; everyone else's from what they report —
 * until the server has ranked the round, whose word replaces both.
 */
export function collectStatuses({
  players,
  selfPlayerId,
  selfHits,
  selfIsOut,
  progress,
  finalRanking,
}: {
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  selfHits: number
  selfIsOut: boolean
  progress: Record<string, Record<string, number>>
  finalRanking: readonly RankedEntry[] | null
}): Map<string, ContestantStatus> {
  const statuses = new Map<string, ContestantStatus>()

  for (const { playerId } of players) {
    if (playerId === selfPlayerId) {
      statuses.set(playerId, { hits: selfHits, isOut: selfIsOut, lastPress: null })
      continue
    }
    const ranked = finalRanking?.find((entry) => entry.playerId === playerId)
    if (ranked !== undefined) {
      const hits = ranked.detail.hits
      statuses.set(playerId, {
        hits: typeof hits === 'number' ? hits : 0,
        isOut: ranked.detail.survived === false,
        lastPress: pressOf(progress[playerId]),
      })
      continue
    }
    const hits = progress[playerId]?.hits ?? 0
    statuses.set(playerId, {
      hits,
      isOut: hits >= LOG_DODGE.MAX_HITS,
      lastPress: pressOf(progress[playerId]),
    })
  }
  return statuses
}

/** A player's latest press, from their progress report (see `pressReport`). */
function pressOf(report: Record<string, number> | undefined): { action: Action; atMs: number } | null {
  const action = report?.pressAction === undefined ? undefined : ACTIONS[report.pressAction]
  const atMs = report?.pressAtMs
  return action === undefined || atMs === undefined ? null : { action, atMs }
}

/**
 * What a player reports for other screens: their hits, and their latest press
 * as an index into ACTIONS and a round time, so the others can play it.
 */
export function pressReport(
  hits: number,
  lastPress: { action: Action; atMs: number } | null,
): Record<string, number> {
  return lastPress === null
    ? { hits }
    : { hits, pressAction: ACTIONS.indexOf(lastPress.action), pressAtMs: lastPress.atMs }
}

/**
 * Whether the round is already decided because one player (or none) is left
 * on their feet, going by what everyone reports. The server ends the round at
 * that moment — the logs stop and whoever is left has won — but it only knows
 * once every player has reported, so each screen works it out for itself too:
 * the last player standing in particular has to report early, or the room
 * would wait out the clock for them.
 *
 * Display-only, like the reports it reads: the server's own ranking replaces it.
 */
export function lastStanding({
  players,
  selfPlayerId,
  selfIsOut,
  progress,
}: {
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  selfIsOut: boolean
  progress: Record<string, Record<string, number>>
}): { isRoundOver: boolean; winnerId: string | null } {
  // A round of one has no early end: it plays out the clock.
  if (players.length < 2) return { isRoundOver: false, winnerId: null }

  const standing = players.filter(({ playerId }) =>
    playerId === selfPlayerId
      ? !selfIsOut
      : (progress[playerId]?.hits ?? 0) < LOG_DODGE.MAX_HITS,
  )
  if (standing.length > 1) return { isRoundOver: false, winnerId: null }
  return { isRoundOver: true, winnerId: standing[0]?.playerId ?? null }
}

/** Who is still standing once the server has ranked the round, or null until then. */
export function survivorsOf(finalRanking: readonly RankedEntry[] | null): Set<string> | null {
  if (finalRanking === null) return null
  return new Set(
    finalRanking.filter((entry) => entry.detail.survived === true).map((entry) => entry.playerId),
  )
}

/** What to say once the player's round is over, or null while there is nothing to say. */
export function describeStatus({
  players,
  selfPlayerId,
  isSpectating,
  isOut,
  isTimeUp,
  lastStandingId,
  finalRanking,
}: {
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  isSpectating: boolean
  isOut: boolean
  isTimeUp: boolean
  /** Who is the only one left on their feet, before the server has said so. */
  lastStandingId: string | null
  finalRanking: readonly RankedEntry[] | null
}): string | null {
  if (finalRanking !== null) {
    const winners = finalRanking.filter((entry) => entry.rank === 1)
    const [winner] = winners
    if (winners.length !== 1 || winner === undefined) return 'Dead heat! Sudden death next…'
    const lastedTheDistance = winner.detail.survived === true
    if (winner.playerId === selfPlayerId) return lastedTheDistance ? 'You’re the last one standing!' : 'You lasted longest!'
    const name = players.find(({ playerId }) => playerId === winner.playerId)?.name ?? 'Someone'
    return lastedTheDistance ? `${name} is the last one standing!` : `${name} lasted longest!`
  }
  if (lastStandingId !== null) {
    if (lastStandingId === selfPlayerId) return 'You’re the last one standing!'
    const name = players.find(({ playerId }) => playerId === lastStandingId)?.name ?? 'Someone'
    return `${name} is the last one standing!`
  }
  if (isSpectating) return 'Watching from the sidelines'
  if (isOut) return 'Knocked out! Watching the rest…'
  if (isTimeUp) return 'You made it! Waiting for the others…'
  return null
}
