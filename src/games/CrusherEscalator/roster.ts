import type { RoundPlayerView } from '../../types/index.ts'

/**
 * Who is on the escalators, in lane order: everyone still in the race, in the
 * room's order. A swallowed runner's lane goes, and the rest close up.
 */
export const selectRoster = ({
  players,
  isOut,
}: {
  players: readonly RoundPlayerView[]
  isOut: (playerId: string) => boolean
}): RoundPlayerView[] => players.filter(({ playerId }) => !isOut(playerId))
