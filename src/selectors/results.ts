import { GAME_CATALOG } from '../shared/games/catalog.ts'
import type {
  LeaderboardPayload,
  RoomStatePayload,
  RoundResultsPayload,
} from '../shared/protocol.ts'
import type { ResultRowView } from '../types/index.ts'
import { formatList } from './round.ts'
import { initialOf, playerColor, selectPlayer } from './players.ts'

/**
 * The reveal for the round that just ended. `ranked` already holds everyone
 * who reported, in order; the no-shows are appended below them.
 */
export function selectResultRows(
  room: RoomStatePayload,
  results: RoundResultsPayload,
  playerId: string | null,
): ResultRowView[] {
  const rows: ResultRowView[] = results.ranked.map((entry) => ({
    id: entry.playerId,
    place: `${entry.rank}.`,
    name: nameOf(room, entry.playerId),
    initial: initialOf(nameOf(room, entry.playerId)),
    color: playerColor(entry.playerId),
    avatar: avatarOf(room, entry.playerId),
    note: describeDetail(entry.detail),
    gain: results.isFinal && entry.playerId === results.winnerId ? '+1' : '—',
    isYou: entry.playerId === playerId,
  }))

  return rows.concat(
    results.noShow.map((absentId) => ({
      id: absentId,
      place: '—',
      name: nameOf(room, absentId),
      initial: initialOf(nameOf(room, absentId)),
      color: playerColor(absentId),
      avatar: avatarOf(room, absentId),
      note: 'never reported',
      gain: '—',
      isYou: absentId === playerId,
    })),
  )
}

function nameOf(room: RoomStatePayload, playerId: string): string {
  return selectPlayer(room, playerId)?.name ?? 'Someone'
}

function avatarOf(room: RoomStatePayload, playerId: string): string {
  return selectPlayer(room, playerId)?.avatar ?? ''
}

/**
 * Games describe their own results, so this formats the keys it knows and
 * falls back to printing whatever else a game chose to send.
 */
function describeDetail(detail: Record<string, number | string | boolean>): string {
  const parts: string[] = []

  // Type Racer Roulette: how the race went for this player.
  if (typeof detail['paragraphCount'] === 'number' && typeof detail['paragraphsDone'] === 'number') {
    const status = detail['status']
    if (detail['lastSurvivor'] === true) {
      parts.push('last one standing')
    } else if (status === 'finished' && typeof detail['endedAtMs'] === 'number') {
      parts.push(`finished in ${clock(detail['endedAtMs'])}`)
    } else {
      const cause = detail['eliminatedBy'] === 'time' ? 'out of time' : detail['eliminatedBy'] === 'skull' ? 'a skull' : 'still typing'
      parts.push(`${cause} · ${detail['paragraphsDone']}/${detail['paragraphCount']} paragraphs`)
    }
    if (typeof detail['rollsCast'] === 'number' && detail['rollsCast'] > 0) {
      parts.push(`${detail['rollsCast']} ${detail['rollsCast'] === 1 ? 'roll' : 'rolls'} survived`)
    }
  }

  if (typeof detail['elapsedMs'] === 'number') {
    parts.push(`${seconds(detail['elapsedMs'])}s`)
  }
  if (typeof detail['errorMs'] === 'number') {
    parts.push(
      detail['errorMs'] === 0 ? 'exact' : `off by ${seconds(detail['errorMs'])}s`,
    )
  }
  if (typeof detail['correctCount'] === 'number' && typeof detail['puzzleCount'] === 'number') {
    parts.push(`${detail['correctCount']}/${detail['puzzleCount']} right`)
    if (typeof detail['correctAnswerMs'] === 'number' && detail['correctCount'] > 0) {
      parts.push(`${seconds(detail['correctAnswerMs'])}s`)
    }
  }
  if (detail['timingSuspect'] === true) parts.push('timing suspect')

  if (parts.length > 0) return parts.join(' · ')

  return Object.entries(detail)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ')
}

const seconds = (ms: number): string => (ms / 1000).toFixed(2)

/** A race time as minutes and seconds, e.g. 1:42. */
const clock = (ms: number): string => {
  const whole = Math.round(ms / 1000)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function selectResultHeadline(
  room: RoomStatePayload,
  results: RoundResultsPayload,
): string {
  if (results.winnerId === null) return 'Nobody took it.'
  const name = nameOf(room, results.winnerId)
  if (results.decidedByCoinFlip) return `${name} wins the coin flip.`
  if (!results.isFinal) return `${name} leads. Tiebreak.`
  return `${name} takes it.`
}

export function selectResultEyebrow(results: RoundResultsPayload): string {
  const title = results.gameId ? GAME_CATALOG[results.gameId].title : 'ROUND'
  return results.isFinal
    ? `${title.toUpperCase()} · RESULT`
    : `${title.toUpperCase()} · TIEBREAK ${results.attempt}`
}

/* ---------------------------------------------------------------- */
/* Final standings                                                    */
/* ---------------------------------------------------------------- */

export function selectChampionLine(
  room: RoomStatePayload,
  leaderboard: LeaderboardPayload,
): string {
  if (leaderboard.rows.length === 0) return 'Nobody wins the night.'
  if (leaderboard.tied) return 'Dead heat.'
  return `${nameOf(room, leaderboard.rows[0].playerId)} wins the night.`
}

export function selectChampionNote(
  room: RoomStatePayload,
  leaderboard: LeaderboardPayload,
): string {
  const top = leaderboard.rows.filter((row) => row.rank === 1)
  if (top.length === 0) return 'The room emptied before anyone scored.'

  if (leaderboard.tied) {
    const names = formatList(top.map((row) => nameOf(room, row.playerId)))
    return `${names} finished level on ${top[0].points}. There is no overall tiebreaker, so argue about it yourselves.`
  }

  const points = top[0].points
  const games = room.playlist.length
  return `${points} ${points === 1 ? 'point' : 'points'} across ${games} ${
    games === 1 ? 'game' : 'games'
  }. Everyone else can take it up with HR.`
}
