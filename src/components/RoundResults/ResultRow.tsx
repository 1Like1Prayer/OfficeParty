import { color, fluid, font, sharedStyles } from '../../theme/index.ts'
import type { ResultRowView } from '../../types/index.ts'
import { Avatar, Panel } from '../ui/index.ts'

interface ResultRowProps {
  row: ResultRowView
  /** Staggers the row's entrance so the table lands one line at a time. */
  delay: string
}

export function ResultRow({ row, delay }: ResultRowProps) {
  return (
    <Panel
      radius={14}
      background={row.isYou ? color.leaderBg : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: fluid(10, 16),
        padding: `${fluid(8, 10)} ${fluid(12, 18)}`,
        animation: 'pa-swoop .55s ease-out both',
        animationDelay: delay,
      }}
    >
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: fluid(19, 24),
          width: fluid(30, 44),
          flexShrink: 0,
          color: color.mutedStrong,
        }}
      >
        {row.place}
      </div>
      <Avatar initial={row.initial} background={row.color} seed={row.avatar} size={34} />
      {/* The note wraps under the name once the row is too narrow for both. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: fluid(10, 16),
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', fontWeight: 700, fontSize: fluid(17, 21) }}>
          {/* A long name gives way before the "(you)" does. */}
          <span style={{ minWidth: 0, ...sharedStyles.ellipsis }}>{row.name}</span>
          {row.isYou && (
            <span style={{ flexShrink: 0, whiteSpace: 'pre', color: color.mutedStrong }}> (you)</span>
          )}
        </div>
        {row.note && (
          <div style={{ fontSize: fluid(13, 15), color: color.mutedStrong, fontWeight: 700 }}>
            {row.note}
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: fluid(19, 22),
          color: color.red,
          minWidth: fluid(44, 62),
          flexShrink: 0,
          textAlign: 'right',
        }}
      >
        {row.gain}
      </div>
    </Panel>
  )
}
