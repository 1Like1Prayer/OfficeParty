import { useMediaQuery } from '../../hooks/index.ts'
import { breakpoint, fluid, sharedStyles } from '../../theme/index.ts'
import type { ResultRowView } from '../../types/index.ts'
import { PushButton } from '../ui/index.ts'
import { ResultRow } from './ResultRow.tsx'

interface RoundResultsProps {
  eyebrow: string
  headline: string
  rows: ResultRowView[]
  /** Null when the server is not holding on a timer, e.g. mid-tiebreak. */
  skipLabel: string | null
  onSkip: () => void
}

/** Placement table for the round that just resolved. */
export function RoundResults({
  eyebrow,
  headline,
  rows,
  skipLabel,
  onSkip,
}: RoundResultsProps) {
  const compact = useMediaQuery(breakpoint.compact)

  return (
    <section style={{ ...sharedStyles.phasePane, gap: fluid(16, 22) }}>
      <div>
        <div style={{ ...sharedStyles.eyebrow, marginBottom: 8 }}>{eyebrow}</div>
        <h1 style={{ ...sharedStyles.displayHeading, margin: 0, fontSize: fluid(34, 62), lineHeight: 1 }}>
          {headline}
        </h1>
      </div>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: 760,
        }}
      >
        {rows.map((row, index) => (
          <li key={row.id}>
            <ResultRow row={row} delay={`${(index * 0.11).toFixed(2)}s`} />
          </li>
        ))}
      </ol>
      {skipLabel && (
        <div style={{ alignSelf: compact ? 'stretch' : 'flex-start' }}>
          <PushButton fullWidth={compact} onClick={onSkip}>{skipLabel}</PushButton>
        </div>
      )}
    </section>
  )
}
