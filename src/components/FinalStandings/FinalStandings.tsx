import { useMediaQuery } from '../../hooks/index.ts'
import { breakpoint, color, fluid, sharedStyles } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'

interface FinalStandingsProps {
  championLine: string
  /** The overall winner, crowned, shown big under the headline; null for a tie or an empty night. */
  championName: string | null
  /** A line of explanation, or null when the headline and name say it all. */
  championNote: string | null
  /** Null on a screen that does not own the room. */
  onBackToLobby: (() => void) | null
}

/** End of the run: who won, with the table itself living in the rail. */
export function FinalStandings({
  championLine,
  championName,
  championNote,
  onBackToLobby,
}: FinalStandingsProps) {
  const compact = useMediaQuery(breakpoint.compact)

  return (
    <section style={{ ...sharedStyles.phasePane, gap: fluid(18, 28) }}>
      <h1
        style={{
          ...sharedStyles.displayHeading,
          margin: 0,
          fontSize: fluid(44, 96),
          lineHeight: 0.92,
          letterSpacing: '-0.035em',
          color: color.red,
        }}
      >
        {championLine}
      </h1>
      {championName !== null && (
        <div
          style={{
            ...sharedStyles.displayHeading,
            fontSize: fluid(34, 72),
            color: color.ink,
            animation: 'pa-pop .5s cubic-bezier(.34,1.56,.64,1) .2s both',
          }}
        >
          {championName}
        </div>
      )}
      {championNote !== null && (
        <p style={{ margin: 0, fontSize: fluid(17, 22), color: color.muted, maxWidth: '40ch', lineHeight: 1.5, textWrap: 'pretty' }}>
          {championNote}
        </p>
      )}
      {onBackToLobby && (
        <div style={{ alignSelf: compact ? 'stretch' : 'flex-start' }}>
          <PushButton fullWidth={compact} onClick={onBackToLobby}>Run it back</PushButton>
        </div>
      )}
    </section>
  )
}
