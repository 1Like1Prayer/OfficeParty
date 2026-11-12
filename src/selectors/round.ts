import { GAME_CATALOG, type GameMeta } from '../shared/games/catalog.ts'
import type {
  RoomStatePayload,
  RoundResultsPayload,
  RoundView,
  StartBlockedReason,
} from '../shared/protocol.ts'
import type { NextStageView } from '../types/index.ts'
import { selectNames, selectOwnerName } from './players.ts'

/** Metadata for the game being revealed, played or scored. */
export function selectCurrentGame(round: RoundView): GameMeta | null {
  return round.gameId ? GAME_CATALOG[round.gameId] : null
}

const KIND_LABEL: Record<GameMeta['kind'], string> = {
  'self-timed': 'EVERYONE AT ONCE',
  'shared-world': 'SHARED ARENA',
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
  const game = `GAME ${gameIndex}/${totalGames}`
  // Each game sets its own round count; a single round needs no counter.
  return roundsPerGame > 1 ? `${game} · ROUND ${roundInGame}/${roundsPerGame}` : game
}

/** Why start is unavailable, in the room's own words. */
export function selectStartBlockedLine(room: RoomStatePayload, isOwner: boolean): string {
  // A screen that only shows the room cannot drive it — say whose call it is.
  if (!isOwner) return `${selectOwnerName(room)} is running this one.`

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
export function selectPlayStatusLine(
  room: RoomStatePayload,
  round: RoundView,
  isParticipant: boolean,
): string {
  if (!isParticipant && ['countdown', 'playing'].includes(round.phase)) {
    return 'Watching this one out.'
  }
  switch (round.phase) {
    case 'loading':
      return 'Dealing the round…'
    case 'ready-check':
      return round.waitingFor.length > 0
        ? `Waiting on ${formatList(selectNames(room, round.waitingFor))}.`
        : 'Everyone is in.'
    case 'starting':
      return 'Everyone is in.'
    // The play screen speaks for itself once the round is on; nothing is
    // captioned underneath it.
    case 'countdown':
    case 'playing':
      return ''
    default:
      return ''
  }
}

/**
 * Whether the game's own screen has the whole pane. That is the race itself,
 * the game's ending animation once the round is decided, and — for a game with
 * stages — the pause and set-up between one stage and the next, so the screen
 * never drops back to a menu in the middle of a scoring round.
 */
export function selectGameScreenIsUp({
  round,
  results,
  isParticipant,
  isFinishing,
  nextStage,
}: {
  round: RoundView
  results: RoundResultsPayload | null
  isParticipant: boolean
  /** The game's ending animation is still playing. */
  isFinishing: boolean
  nextStage: NextStageView | null
}): boolean {
  switch (round.phase) {
    case 'countdown':
    case 'playing':
      return true
    case 'results':
      return results !== null && (results.advancing !== null || (isFinishing && isParticipant))
    case 'loading':
    case 'ready-check':
    case 'starting':
      return nextStage !== null
    default:
      return false
  }
}
