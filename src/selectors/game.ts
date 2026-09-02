import type { Game, GameKind, RoomState } from '../types/index.ts'

const FORMAT_LABEL: Record<GameKind, string> = {
  SURVIVE: 'LAST SURVIVOR',
  RACE: 'RACE TO FINISH',
  PRECISION: 'PRECISION',
}

/** The game being revealed, played or scored. Null if the playlist is empty. */
export function selectCurrentGame(room: RoomState): Game | null {
  if (room.playlist.length === 0) return null
  const index = Math.min(Math.max(room.currentIndex, 0), room.playlist.length - 1)
  return room.playlist[index]
}

export function selectFormatLabel(kind: GameKind): string {
  return FORMAT_LABEL[kind]
}

export function selectIsLastGame(room: RoomState): boolean {
  return room.currentIndex >= room.playlist.length - 1
}

export function selectRoundLabel(room: RoomState): string {
  if (room.phase === 'lobby') return 'NOT STARTED'
  if (room.phase === 'final') return 'FINISHED'
  return `GAME ${room.currentIndex + 1} / ${room.playlist.length}`
}
