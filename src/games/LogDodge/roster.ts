import type { RoundPlayerView } from '../../types/index.ts'
import { MAX_VISIBLE_CONTESTANTS } from './scene/sceneConfig.ts'

/**
 * The players who get a place on the belt: this player first of all, then the
 * others in the room's order until it is full. Everyone still plays — those
 * left out just are not drawn.
 */
export function pickVisiblePlayers(
  players: readonly RoundPlayerView[],
  selfPlayerId: string,
): RoundPlayerView[] {
  const others = players.filter(({ playerId }) => playerId !== selfPlayerId)
  const isPlaying = others.length < players.length
  const room = isPlaying ? MAX_VISIBLE_CONTESTANTS - 1 : MAX_VISIBLE_CONTESTANTS
  const kept = new Set(others.slice(0, room).map(({ playerId }) => playerId))
  return players.filter(({ playerId }) => playerId === selfPlayerId || kept.has(playerId))
}
