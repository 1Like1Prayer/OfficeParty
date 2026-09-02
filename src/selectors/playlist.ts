import type { PlaylistRowView, RoomState } from '../types/index.ts'

const PLAYLIST_COLORS = {
  current: { text: '#FFC400', dot: '#FF4D2E' },
  played: { text: '#5E5747', dot: '#3A3225' },
  upcoming: { text: '#B9AF98', dot: '#7C7361' },
} as const

export function selectPlaylistRows(room: RoomState): PlaylistRowView[] {
  return room.playlist.map((game, index) => {
    const palette = PLAYLIST_COLORS[playlistPosition(index, room)]
    return {
      id: game.id,
      name: `${index + 1}. ${game.name}`,
      kind: game.kind,
      color: palette.text,
      dotColor: palette.dot,
    }
  })
}

function playlistPosition(index: number, room: RoomState): keyof typeof PLAYLIST_COLORS {
  if (room.phase !== 'lobby' && index === room.currentIndex) return 'current'
  return index < room.currentIndex ? 'played' : 'upcoming'
}
