import type { Floater } from '../components/Lobby/ConnectedCard.tsx'
import type { PoolChipView } from '../components/Lobby/GamePoolCard.tsx'
import { GAME_CATALOG, GAME_IDS, type GameId } from '../shared/games/catalog.ts'
import type { RoomView } from '../network/index.ts'
import { initialOf, playerColor, selectPlayers } from './players.ts'

/**
 * Spread the avatars over the card on a centred grid, with enough padding for
 * the 82px block and the float animation's swing.
 */
export function selectFloaters(room: RoomView): Floater[] {
  const players = selectPlayers(room).filter((player) => player.connected)
  return players.map((player, index) => ({
    id: player.playerId,
    name: player.name,
    initial: initialOf(player.name),
    color: playerColor(player.playerId),
    avatar: player.avatar,
    duration: `${(5.5 + (index % 4) * 0.9).toFixed(1)}s`,
    delay: `-${(index * 0.7).toFixed(1)}s`,
  }))
}

/** Games the server will actually accept in a playlist. */
export function selectPlayableGames(room: RoomView): GameId[] {
  return room.lobby.playableGames
}

/**
 * What the pool is currently set to. In random mode the server draws from
 * everything playable, so that is what the chips show.
 */
export function selectSelectedGames(room: RoomView): GameId[] {
  return room.mode === 'random' ? room.lobby.playableGames : room.playlist
}

export function selectPoolChips(room: RoomView): PoolChipView[] {
  const playable = new Set(room.lobby.playableGames)
  const selected = new Set(selectSelectedGames(room))

  return GAME_IDS.map((gameId) => ({
    id: gameId,
    name: GAME_CATALOG[gameId].title,
    selected: selected.has(gameId),
    playable: playable.has(gameId),
  }))
}

export function selectToggleAllLabel(room: RoomView): string {
  const selected = selectSelectedGames(room)
  return selected.length >= room.lobby.playableGames.length ? 'CLEAR ALL' : 'SELECT ALL'
}

export function selectSetupSummary(room: RoomView): string {
  const games = selectSelectedGames(room).length
  return `${games} GAME${games === 1 ? '' : 'S'} IN THE POOL`
}

export function selectLobbyEmptyLine(room: RoomView): string {
  return `Nobody yet. Open the room code ${room.roomCode} on a phone to join.`
}
