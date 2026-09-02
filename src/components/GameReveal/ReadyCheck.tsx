import { formatList } from '../../selectors/index.ts'
import { color, font } from '../../theme/index.ts'

interface ReadyCheckProps {
  waitingFor: string[]
  readyCount: number
  participantCount: number
}

/** Who has pressed ready, and who the room is still hanging on. */
export function ReadyCheck({ waitingFor, readyCount, participantCount }: ReadyCheckProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 34,
          color: color.ink,
        }}
      >
        {readyCount} / {participantCount} ready
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: 15,
          color: color.mutedStrong,
          animation: 'pa-pulse 2.4s ease-in-out infinite',
        }}
      >
        {waitingFor.length > 0
          ? `Waiting on ${formatList(waitingFor)}.`
          : 'Everyone is in. Starting…'}
      </div>
    </div>
  )
}
