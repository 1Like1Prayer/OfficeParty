import { GAME_CATALOG, type GameMeta } from '../shared/games/catalog.ts'
import type { RoomStatePayload, RoundView, StartBlockedReason } from '../shared/protocol.ts'
import { selectNames } from './players.ts'

/** Metadata for the game being revealed, played or scored. */
export function selectCurrentGame(round: RoundView): GameMeta | null {
  return round.gameId ? GAME_CATALOG[round.gameId] : null
}

const KIND_LABEL: Record<GameMeta['kind'], string> = {
  'self-timed': 'EVERYONE AT ONCE',
  'shared-world': 'SHARED ARENA',
  'turn-based': 'TAKE TURNS',
}

export function selectFormatLabel(kind: GameMeta['kind']): string {
  return KIND_LABEL[kind]
}

/** The pill in the header. */
export function selectRoundLabel(room: RoomStatePayload, round: RoundView): string {
  if (room.phase === 'lobby') return 'NOT STARTED'
  if (room.phase === 'leaderboard') return 'FINISHED'

  const { gameIndex, totalGames, roundInGame, roundsPerGame, isTiebreak } = round
  if (isTiebreak) return 'TIEBREAK'
  if (gameIndex === 0) return 'STARTING'
  return `GAME ${gameIndex}/${totalGames} · ROUND ${roundInGame}/${roundsPerGame}`
}

/** Why the owner cannot press start yet, in the room's own words. */
export function selectStartBlockedLine(room: RoomStatePayload): string {
  const reasons: Record<StartBlockedReason, () => string> = {
    not_enough_players: () =>
      `Need ${room.minPlayers} players. ${describeCount(room)} so far.`,
    players_not_ready: () =>
      `Waiting on ${formatList(selectNames(room, room.lobby.waitingFor))}.`,
    invalid_playlist: () => 'No playable games are available.',
  }
  const reason = room.lobby.blockedReason
  return reason ? reasons[reason]() : 'Everyone is in. Press it.'
}

function describeCount(room: RoomStatePayload): string {
  const count = room.lobby.ready.length + room.lobby.waitingFor.length
  return count === 1 ? '1 here' : `${count} here`
}

export function formatList(names: string[]): string {
  if (names.length === 0) return 'nobody'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** What the play screen says while the round moves through its phases. */
export function selectPlayStatusLine(room: RoomStatePayload, round: RoundView): string {
  switch (round.phase) {
    case 'loading':
      return 'Dealing the round…'
    case 'ready-check':
      return round.waitingFor.length > 0
        ? `Waiting on ${formatList(selectNames(room, round.waitingFor))}.`
        : 'Everyone is in.'
    case 'starting':
      return 'Get ready…'
    case 'countdown':
      return 'Here we go.'
    case 'playing':
      return 'Phones are live. This screen is the shared truth.'
    default:
      return ''
  }
}
