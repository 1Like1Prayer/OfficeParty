import { color, sharedStyles } from '../../theme/index.ts'
import type { PlaylistRowView } from '../../types/index.ts'

interface PlaylistRowProps {
  row: PlaylistRowView
}

export function PlaylistRow({ row }: PlaylistRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 15,
        fontWeight: 700,
        color: row.color,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: row.dotColor,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, ...sharedStyles.ellipsis }}>{row.name}</div>
      <div style={{ fontSize: 11, letterSpacing: '0.12em', color: color.mutedSoft }}>{row.kind}</div>
    </div>
  )
}
