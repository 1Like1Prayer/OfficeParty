import { sharedStyles } from '../../theme/index.ts'
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
  return (
    <section style={{ ...sharedStyles.phasePane, padding: '36px 52px', gap: 22 }}>
      <div>
        <div style={{ ...sharedStyles.eyebrow, marginBottom: 8 }}>{eyebrow}</div>
        <h1 style={{ ...sharedStyles.displayHeading, margin: 0, fontSize: 62, lineHeight: 1 }}>
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
            <ResultRow row={row} delay={`${(index * 0.07).toFixed(2)}s`} />
          </li>
        ))}
      </ol>
      {skipLabel && (
        <div style={{ alignSelf: 'flex-start' }}>
          <PushButton onClick={onSkip}>{skipLabel}</PushButton>
        </div>
      )}
    </section>
  )
}
