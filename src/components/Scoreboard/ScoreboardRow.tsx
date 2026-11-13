import { color, fluid, font, sharedStyles } from '../../theme/index.ts'
import type { ScoreboardRowView } from '../../types/index.ts'
import { Avatar, ConfirmButton } from '../ui/index.ts'

interface ScoreboardRowProps {
  row: ScoreboardRowView
  /** Set for the owner only. */
  onKick: (() => void) | null
}

export function ScoreboardRow({ row, onKick }: ScoreboardRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: fluid(8, 12),
        padding: `${fluid(8, 10)} ${fluid(10, 14)}`,
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
          fontSize: fluid(17, 20),
          width: fluid(20, 26),
          flexShrink: 0,
          color: color.mutedStrong,
        }}
      >
        {row.rank}
      </div>
      <Avatar initial={row.initial} background={row.color} seed={row.avatar} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', fontWeight: 700, fontSize: fluid(16, 19) }}>
          {/* A long name gives way before the "(you)" does. */}
          <span style={{ minWidth: 0, ...sharedStyles.ellipsis }}>{row.name}</span>
          {row.isYou && (
            <span style={{ flexShrink: 0, whiteSpace: 'pre', color: color.mutedStrong }}> (you)</span>
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: color.mutedStrong,
            ...sharedStyles.ellipsis,
          }}
        >
          {row.status}
        </div>
      </div>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: fluid(22, 28),
          color: row.pointsColor,
          flexShrink: 0,
        }}
      >
        {row.points}
      </div>
      {onKick && (
        <ConfirmButton
          badge
          label="×"
          title={`Remove ${row.name}`}
          confirmLabel="Remove?"
          onConfirm={onKick}
          style={{ flexShrink: 0 }}
        />
      )}
    </div>
  )
}
