import type { CrusherEscalatorRound } from '../../shared/games/crusherEscalator/types.ts'
import type { NextStageView, RoundPlayerView } from '../../types/index.ts'
import { pickVisiblePlayers } from './arena/visiblePlayers.ts'

const playersWithIds = (
  ids: readonly string[],
  players: readonly RoundPlayerView[],
): RoundPlayerView[] =>
  ids.flatMap((id) => players.find(({ playerId }) => playerId === id) ?? [])

/** The group this player races in; a spectator is shown the first. */
export const groupOf = (
  groups: readonly (readonly string[])[],
  playerId: string,
): readonly string[] => groups.find((group) => group.includes(playerId)) ?? groups[0] ?? []

/**
 * Who is drawn on the escalators, in lane order:
 *  - between stages, the players going through, best first — the next stage's
 *    line-up, so the scene can set them down in their new places;
 *  - in the heats, the heat this player is racing in;
 *  - otherwise everyone in the race.
 */
export function selectRoster({
  round,
  players,
  nextStage,
  selfPlayerId,
}: {
  round: CrusherEscalatorRound | null
  players: readonly RoundPlayerView[]
  nextStage: NextStageView | null
  selfPlayerId: string
}): RoundPlayerView[] {
  let roster = players
  if (nextStage !== null) roster = playersWithIds(nextStage.playerIds, players)
  else if (round?.stage === 'heats') roster = playersWithIds(groupOf(round.groups, selfPlayerId), players)
  return pickVisiblePlayers(roster, selfPlayerId)
}
