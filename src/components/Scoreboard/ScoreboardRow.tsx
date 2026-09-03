import { color, font, sharedStyles } from '../../theme/index.ts'
import type { ScoreboardRowView } from '../../types/index.ts'
import { Avatar } from '../ui/index.ts'

interface ScoreboardRowProps {
  row: ScoreboardRowView
}

export function ScoreboardRow({ row }: ScoreboardRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 14,
        background: row.background,
        border: `${row.isYou ? 3 : 2}px solid ${color.ink}`,
        opacity: row.dimmed ? 0.5 : 1,
      }}
    >
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 20,
          width: 26,
          color: color.mutedStrong,
        }}
      >
        {row.rank}
      </div>
      <Avatar initial={row.initial} background={row.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 19, ...sharedStyles.ellipsis }}>
          {row.name}
          {row.isYou && <span style={{ color: color.mutedStrong }}> (you)</span>}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: color.mutedStrong,
          }}
        >
          {row.status}
        </div>
      </div>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 28,
          color: row.pointsColor,
        }}
      >
        {row.points}
      </div>
    </div>
  )
}
