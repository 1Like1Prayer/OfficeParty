import type { ResultRowView, RoomState } from '../types/index.ts'
import { selectRankedPlayers } from './scoreboard.ts'

/** Last game's finishing order, first place first. */
export function selectResultRows(room: RoomState): ResultRowView[] {
  return [...room.players]
    .sort((a, b) => a.place - b.place)
    .map((player) => ({
      id: player.id,
      place: `${player.place}.`,
      name: player.name,
      initial: player.name.charAt(0),
      color: player.color,
      note: player.note,
      gain: player.lastGain > 0 ? `+${player.lastGain}` : '—',
    }))
}

export function selectWinnerLine(room: RoomState): string {
  const [winner] = selectResultRows(room)
  return `${winner?.name ?? 'Nobody'} takes it.`
}

function selectIsTied(room: RoomState): boolean {
  const ranked = selectRankedPlayers(room)
  const leader = ranked[0]
  if (!leader) return false
  return ranked.filter((player) => player.points === leader.points).length > 1
}

export function selectChampionLine(room: RoomState): string {
  if (selectIsTied(room)) return 'Dead heat.'
  const leader = selectRankedPlayers(room)[0]
  return leader ? `${leader.name} wins the night.` : 'Nobody wins the night.'
}

export function selectChampionNote(room: RoomState): string {
  if (selectIsTied(room)) {
    return 'Two people finished level on points. Sudden death is Stop the Clock, and it is not negotiable.'
  }
  const leader = selectRankedPlayers(room)[0]
  const points = leader?.points ?? 0
  return `${points} points across ${room.playlist.length} games. Everyone else can take it up with HR.`
}
