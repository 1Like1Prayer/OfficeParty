import type { RoundPlayerView } from '../../../types/index.ts'
import { MAX_VISIBLE_LANES } from './arenaConfig.ts'

/**
 * The players who get a lane on screen: this player first of all, then others
 * in the room's order until the screen is full. Everyone still races — those
 * left out just are not drawn. A spectator is not in the list, so they get the
 * whole screen's worth of others.
 */
export function pickVisiblePlayers(
  players: readonly RoundPlayerView[],
  selfPlayerId: string,
): RoundPlayerView[] {
  const others = players.filter(({ playerId }) => playerId !== selfPlayerId)
  const isPlaying = others.length < players.length
  const room = isPlaying ? MAX_VISIBLE_LANES - 1 : MAX_VISIBLE_LANES
  const kept = new Set(others.slice(0, room).map(({ playerId }) => playerId))
  return players.filter(({ playerId }) => playerId === selfPlayerId || kept.has(playerId))
}
