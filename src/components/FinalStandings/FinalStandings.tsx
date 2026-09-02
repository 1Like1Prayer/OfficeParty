import { color, sharedStyles } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'

interface FinalStandingsProps {
  championLine: string
  championNote: string
  onResetRun: () => void
}

/** End of the run: who won and the invitation to go again. */
export function FinalStandings({ championLine, championNote, onResetRun }: FinalStandingsProps) {
  return (
    <section style={{ ...sharedStyles.phasePane, gap: 28 }}>
      <div style={sharedStyles.eyebrow}>RUN COMPLETE</div>
      <h1
        style={{
          ...sharedStyles.displayHeading,
          margin: 0,
          fontSize: 96,
          lineHeight: 0.92,
          letterSpacing: '-0.035em',
          color: color.red,
        }}
      >
        {championLine}
      </h1>
      <p style={{ margin: 0, fontSize: 22, color: color.muted, maxWidth: '40ch', lineHeight: 1.5 }}>
        {championNote}
      </p>
      <div style={{ alignSelf: 'flex-start' }}>
        <PushButton onClick={onResetRun}>Run it back</PushButton>
      </div>
    </section>
  )
}
