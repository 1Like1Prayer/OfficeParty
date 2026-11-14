import type { RoundPlayerView } from '../../types/index.ts'
import { pickVisiblePlayers } from './arena/visiblePlayers.ts'

/**
 * Who is drawn on the escalators, in lane order: this player and the
 * neighbours closest to them who are still running, `count` in all.
 */
export const selectRoster = ({
  players,
  selfPlayerId,
  count,
  isOut,
}: {
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  count: number
  isOut: (playerId: string) => boolean
}): RoundPlayerView[] => pickVisiblePlayers(players, selfPlayerId, count, isOut)
