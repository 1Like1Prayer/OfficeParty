import { color, sharedStyles } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'

interface FinalStandingsProps {
  championLine: string
  championNote: string
  /** Null on a screen that does not own the room. */
  onBackToLobby: (() => void) | null
}

/** End of the run: who won, with the table itself living in the rail. */
export function FinalStandings({
  championLine,
  championNote,
  onBackToLobby,
}: FinalStandingsProps) {
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
      {onBackToLobby && (
        <div style={{ alignSelf: 'flex-start' }}>
          <PushButton onClick={onBackToLobby}>Run it back</PushButton>
        </div>
      )}
    </section>
  )
}
