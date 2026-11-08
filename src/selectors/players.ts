import type { PlayerView, RoomStatePayload } from '../shared/protocol.ts'
import { swatches } from '../theme/index.ts'

/**
 * Player colour. The server has no opinion on it, so it is derived from the
 * player id — stable across reconnects and identical on every screen.
 */
export function playerColor(playerId: string): string {
  let hash = 0
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return swatches[hash % swatches.length]
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

/** Everyone in the room. */
export function selectPlayers(room: RoomStatePayload): PlayerView[] {
  return room.players
}

export function selectPlayer(
  room: RoomStatePayload,
  playerId: string,
): PlayerView | undefined {
  return room.players.find((player) => player.playerId === playerId)
}

export function selectNames(room: RoomStatePayload, ids: string[]): string[] {
  return ids
    .map((id) => selectPlayer(room, id)?.name)
    .filter((name): name is string => name !== undefined)
}

/** Who is actually running this room. */
export function selectOwnerName(room: RoomStatePayload): string {
  return selectPlayer(room, room.ownerId)?.name ?? 'Someone else'
}
