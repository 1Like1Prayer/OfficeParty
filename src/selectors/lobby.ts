import type { Floater } from '../components/Lobby/ConnectedCard.tsx'
import type { PoolChipView } from '../components/Lobby/GamePoolCard.tsx'
import { GAME_CATALOG, GAME_IDS, type GameId } from '../shared/games/catalog.ts'
import type { RoomStatePayload } from '../shared/protocol.ts'
import { initialOf, playerColor, selectPlayers } from './players.ts'

/**
 * Spread the avatars over the card on a centred grid, with enough padding for
 * the 82px block and the float animation's swing.
 */
function spot(index: number, total: number) {
  const columns = total <= 2 ? total : total <= 6 ? 3 : 4
  const rows = Math.max(1, Math.ceil(total / columns))
  const column = index % columns
  const row = Math.floor(index / columns)
  const inRow = Math.min(columns, total - row * columns)

  return {
    left: `${(100 / (inRow + 1)) * (column + 1)}%`,
    top: `calc(58px + ${row} * (100% - 116px) / ${rows} + (100% - 116px) / ${rows * 2})`,
    duration: `${(5.5 + (index % 4) * 0.9).toFixed(1)}s`,
    delay: `-${(index * 0.7).toFixed(1)}s`,
  }
}

export function selectFloaters(room: RoomStatePayload): Floater[] {
  const players = selectPlayers(room).filter((player) => player.connected)
  return players.map((player, index) => ({
    id: player.playerId,
    name: player.name,
    initial: initialOf(player.name),
    color: playerColor(player.playerId),
    avatar: player.avatar,
    ...spot(index, players.length),
  }))
}

/** Games the server will actually accept in a playlist. */
export function selectPlayableGames(room: RoomStatePayload): GameId[] {
  return room.lobby.playableGames
}

/**
 * What the pool is currently set to. In random mode the server draws from
 * everything playable, so that is what the chips show.
 */
export function selectSelectedGames(room: RoomStatePayload): GameId[] {
  return room.mode === 'random' ? room.lobby.playableGames : room.playlist
}

export function selectPoolChips(room: RoomStatePayload): PoolChipView[] {
  const playable = new Set(room.lobby.playableGames)
  const selected = new Set(selectSelectedGames(room))

  return GAME_IDS.map((gameId) => ({
    id: gameId,
    name: GAME_CATALOG[gameId].title,
    selected: selected.has(gameId),
    playable: playable.has(gameId),
  }))
}

export function selectToggleAllLabel(room: RoomStatePayload): string {
  const selected = selectSelectedGames(room)
  return selected.length >= room.lobby.playableGames.length ? 'CLEAR ALL' : 'SELECT ALL'
}

export function selectSetupSummary(room: RoomStatePayload): string {
  const games = selectSelectedGames(room).length
  const rounds = room.lobby.roundsPerGame
  return `${rounds} ROUND${rounds === 1 ? '' : 'S'} EACH · ${games} GAME${
    games === 1 ? '' : 'S'
  } IN THE POOL`
}

export function selectLobbyEmptyLine(room: RoomStatePayload): string {
  return `Nobody yet. Open the room code ${room.roomCode} on a phone to join.`
}
