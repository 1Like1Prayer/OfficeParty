import { color, sharedStyles } from '../../theme/index.ts'
import type { ResultRowView } from '../../types/index.ts'
import { ResultRow } from '../RoundResults/ResultRow.tsx'
import { PushButton } from '../ui/index.ts'

interface FinalStandingsProps {
  championLine: string
  championNote: string
  rows: ResultRowView[]
  onBackToLobby: () => void
}

/** End of the run: who won, the full table, and the way back to the lobby. */
export function FinalStandings({
  championLine,
  championNote,
  rows,
  onBackToLobby,
}: FinalStandingsProps) {
  return (
    <section style={{ ...sharedStyles.phasePane, padding: '36px 52px', gap: 20 }}>
      <div style={sharedStyles.eyebrow}>RUN COMPLETE</div>
      <h1
        style={{
          ...sharedStyles.displayHeading,
          margin: 0,
          fontSize: 82,
          lineHeight: 0.92,
          letterSpacing: '-0.035em',
          color: color.red,
        }}
      >
        {championLine}
      </h1>
      <p style={{ margin: 0, fontSize: 20, color: color.muted, maxWidth: '46ch', lineHeight: 1.5 }}>
        {championNote}
      </p>
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
        <PushButton onClick={onBackToLobby}>Back to the lobby</PushButton>
      </div>
    </section>
  )
}
