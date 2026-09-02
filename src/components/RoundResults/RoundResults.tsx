import { sharedStyles } from '../../theme/index.ts'
import type { ResultRowView } from '../../types/index.ts'
import { PushButton } from '../ui/index.ts'
import { ResultRow } from './ResultRow.tsx'

interface RoundResultsProps {
  gameName: string
  winnerLine: string
  rows: ResultRowView[]
  nextLabel: string
  onNextGame: () => void
}

/** Placement table for the game that just ended. */
export function RoundResults({
  gameName,
  winnerLine,
  rows,
  nextLabel,
  onNextGame,
}: RoundResultsProps) {
  return (
    <section style={{ ...sharedStyles.phasePane, padding: '36px 52px', gap: 22 }}>
      <div>
        <div style={{ ...sharedStyles.eyebrow, marginBottom: 8 }}>{gameName} · RESULT</div>
        <h1 style={{ ...sharedStyles.displayHeading, margin: 0, fontSize: 62, lineHeight: 1 }}>
          {winnerLine}
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
        {rows.map((row) => (
          <li key={row.id}>
            <ResultRow row={row} />
          </li>
        ))}
      </ol>
      <div style={{ alignSelf: 'flex-start' }}>
        <PushButton onClick={onNextGame}>{nextLabel}</PushButton>
      </div>
    </section>
  )
}
