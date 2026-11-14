import { useMediaQuery } from '../../hooks/index.ts'
import { border, breakpoint, color, fluid, font, sharedStyles } from '../../theme/index.ts'
import type { ScoreboardRowView } from '../../types/index.ts'
import { ScoreboardRow } from './ScoreboardRow.tsx'

interface ScoreboardProps {
  rows: ScoreboardRowView[]
  playerCountLabel: string
  selfId: string | null
  /** Set for the owner only: everyone else's row gets a remove button. */
  onKick: ((playerId: string) => void) | null
}

/** Persistent right rail: live standings for the run in progress. */
export function Scoreboard({ rows, playerCountLabel, selfId, onKick }: ScoreboardProps) {
  // Below the phase pane rather than beside it once there is no room for a rail.
  const stacked = useMediaQuery(breakpoint.narrow)

  return (
    <aside
      style={{
        width: stacked ? '100%' : 'clamp(300px, 30vw, 400px)',
        flexShrink: 0,
        ...(stacked ? { borderTop: border.heavy } : { borderLeft: border.heavy }),
        background: color.panel,
        display: 'flex',
        flexDirection: 'column',
        animation: stacked ? 'pa-swoop .65s ease-out' : 'pa-slide-in .65s ease-out',
      }}
    >
      <div
        style={{
          padding: `${fluid(16, 20)} ${fluid(18, 26)} 14px`,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: fluid(22, 26) }}>Scoreboard</div>
        <div style={sharedStyles.microLabel}>{playerCountLabel}</div>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: `0 ${fluid(12, 18)} ${fluid(16, 18)}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {rows.map((row) => (
          <ScoreboardRow
            key={row.id}
            row={row}
            onKick={onKick && row.id !== selfId ? () => { onKick(row.id) } : null}
          />
        ))}
      </div>
    </aside>
  )
}
