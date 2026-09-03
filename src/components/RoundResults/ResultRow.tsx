import { color, font } from '../../theme/index.ts'
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
        gap: 16,
        padding: '10px 18px',
        animation: 'pa-swoop .4s ease-out both',
        animationDelay: delay,
      }}
    >
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 24,
          width: 44,
          color: color.mutedStrong,
        }}
      >
        {row.place}
      </div>
      <Avatar initial={row.initial} background={row.color} size={34} />
      <div style={{ flex: 1, fontWeight: 700, fontSize: 21 }}>
        {row.name}
        {row.isYou && <span style={{ color: color.mutedStrong }}> (you)</span>}
      </div>
      <div style={{ fontSize: 15, color: color.mutedStrong, fontWeight: 700 }}>{row.note}</div>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 22,
          color: color.red,
          width: 62,
          textAlign: 'right',
        }}
      >
        {row.gain}
      </div>
    </Panel>
  )
}
