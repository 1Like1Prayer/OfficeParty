import { border, sharedStyles } from '../../theme/index.ts'
import type { PlaylistRowView } from '../../types/index.ts'
import { PlaylistRow } from './PlaylistRow.tsx'

interface PlaylistProps {
  rows: PlaylistRowView[]
}

export function Playlist({ rows }: PlaylistProps) {
  return (
    <div style={{ padding: '14px 26px 20px', borderTop: border.heavy }}>
      <div style={{ ...sharedStyles.microLabel, marginBottom: 10 }}>PLAYLIST</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row) => (
          <PlaylistRow key={row.id} row={row} />
        ))}
      </div>
    </div>
  )
}
