import { border, color, font, sharedStyles } from '../../theme/index.ts'
import type { PlaylistRowView, ScoreboardRowView } from '../../types/index.ts'
import { Playlist } from './Playlist.tsx'
import { ScoreboardRow } from './ScoreboardRow.tsx'

interface ScoreboardProps {
  rows: ScoreboardRowView[]
  playerCountLabel: string
  playlist: PlaylistRowView[]
}

/** Persistent right rail: live standings above, run playlist below. */
export function Scoreboard({ rows, playerCountLabel, playlist }: ScoreboardProps) {
  return (
    <aside
      style={{
        width: 400,
        flexShrink: 0,
        borderLeft: border.heavy,
        background: color.panel,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '20px 26px 14px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26 }}>Scoreboard</div>
        <div style={sharedStyles.microLabel}>{playerCountLabel}</div>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: '0 18px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {rows.map((row) => (
          <ScoreboardRow key={row.id} row={row} />
        ))}
      </div>
      <Playlist rows={playlist} />
    </aside>
  )
}
