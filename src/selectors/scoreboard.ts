import { GAME_CATALOG } from '../shared/games/catalog.ts'
import type { RoomStatePayload, RoundView } from '../shared/protocol.ts'
import { color } from '../theme/index.ts'
import type { PlaylistRowView, ScoreboardRowView } from '../types/index.ts'
import { initialOf, playerColor, selectPlayers } from './players.ts'

/** Standings, highest first, with lobby readiness folded into the status. */
export function selectScoreboardRows(
  room: RoomStatePayload,
  round: RoundView,
  /** Points from the round events, which run ahead of the last snapshot. */
  scores: Record<string, number>,
  /** The reader, so their own row can be marked. */
  playerId: string | null,
): ScoreboardRowView[] {
  const pointsOf = (playerId: string, fallback: number) => scores[playerId] ?? fallback

  const ranked = [...selectPlayers(room)].sort(
    (a, b) =>
      pointsOf(b.playerId, b.points) - pointsOf(a.playerId, a.points) ||
      a.name.localeCompare(b.name),
  )

  return ranked.map((player, index) => {
    const points = pointsOf(player.playerId, player.points)
    const isLeader = index === 0 && points > 0
    return {
      id: player.playerId,
      rank: index + 1,
      name: player.name,
      initial: initialOf(player.name),
      color: playerColor(player.playerId),
      points,
      status: statusFor(player, room, round, points),
      isYou: player.playerId === playerId,
      background: isLeader ? color.leaderBg : color.white,
      pointsColor: isLeader ? color.red : color.ink,
      dimmed: !player.connected || player.isSpectator,
    }
  })
}

function statusFor(
  player: RoomStatePayload['players'][number],
  room: RoomStatePayload,
  round: RoundView,
  points: number,
): string {
  if (!player.connected) return 'DISCONNECTED'
  if (player.isSpectator) return 'WATCHING'
  if (room.phase === 'lobby') return player.ready ? 'READY' : 'NOT READY'
  if (room.phase === 'competition') {
    if (round.waitingFor.includes(player.playerId)) return 'WAITING'
    if (round.participants.includes(player.playerId)) return 'IN THIS ROUND'
  }
  return points === 1 ? '1 POINT' : `${points} POINTS`
}

export function selectPlayerCountLabel(room: RoomStatePayload): string {
  const players = selectPlayers(room).filter((p) => !p.isSpectator)
  return players.length === 1 ? '1 PLAYER' : `${players.length} PLAYERS`
}

const PLAYLIST_COLORS = {
  current: { text: '#FFC400', dot: '#FF4D2E' },
  played: { text: '#5E5747', dot: '#3A3225' },
  upcoming: { text: '#B9AF98', dot: '#7C7361' },
} as const

/**
 * The set list. `round.gameIndex` is 1-based and is 0 before the competition
 * starts, so nothing is marked current in the lobby.
 */
export function selectPlaylistRows(
  room: RoomStatePayload,
  round: RoundView,
): PlaylistRowView[] {
  const currentIndex = room.phase === 'competition' ? round.gameIndex : 0

  return room.playlist.map((gameId, index) => {
    const position =
      index + 1 === currentIndex
        ? 'current'
        : index + 1 < currentIndex
          ? 'played'
          : 'upcoming'
    const palette = PLAYLIST_COLORS[position]
    const meta = GAME_CATALOG[gameId]
    return {
      id: `${gameId}-${index}`,
      name: `${index + 1}. ${meta.title}`,
      kind: meta.kind.toUpperCase(),
      color: palette.text,
      dotColor: palette.dot,
    }
  })
}
