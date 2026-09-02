import { color } from '../theme/index.ts'
import type { Player, RoomState, ScoreboardRowView } from '../types/index.ts'

/** Players sorted by points, highest first. */
export function selectRankedPlayers(room: RoomState): Player[] {
  return [...room.players].sort((a, b) => b.points - a.points)
}

export function selectScoreboardRows(room: RoomState): ScoreboardRowView[] {
  return selectRankedPlayers(room).map((player, index) => {
    const isLeader = index === 0 && player.points > 0
    return {
      id: player.id,
      rank: index + 1,
      name: player.name,
      initial: player.name.charAt(0),
      color: player.color,
      points: player.points,
      status: statusFor(player, room),
      background: isLeader ? color.leaderBg : color.white,
      pointsColor: isLeader ? color.red : color.ink,
    }
  })
}

function statusFor(player: Player, room: RoomState): string {
  if (player.lastGain > 0) return `+${player.lastGain} LAST GAME`
  return room.phase === 'lobby' ? 'READY' : 'NO POINTS'
}

export function selectPlayerCountLabel(room: RoomState): string {
  return `${room.players.length} PLAYERS`
}
