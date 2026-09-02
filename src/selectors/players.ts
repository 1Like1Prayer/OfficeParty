import type { PlayerView, RoomStatePayload } from '../shared/protocol.ts'

/**
 * Player swatches. The server has no opinion on colour, so it is derived from
 * the player id — stable across reconnects and identical on every screen.
 */
const SWATCHES = [
  '#FF5FA2',
  '#FFC400',
  '#3FD9A8',
  '#FF7A2E',
  '#8B7BFF',
  '#4FC3F7',
  '#E5382F',
  '#9CCC65',
] as const

export function playerColor(playerId: string): string {
  let hash = 0
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return SWATCHES[hash % SWATCHES.length]
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

/** Everyone the room treats as a person — the arena's own tile is not one. */
export function selectHumanPlayers(room: RoomStatePayload): PlayerView[] {
  return room.players.filter((player) => !player.isDisplay)
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
