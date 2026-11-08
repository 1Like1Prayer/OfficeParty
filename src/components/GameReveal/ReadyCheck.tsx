import { formatList } from '../../selectors/index.ts'
import { color, font } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'

interface ReadyCheckProps {
  waitingFor: string[]
  readyCount: number
  participantCount: number
  /** Null when this player is not in the round, or is already ready. */
  onReady: (() => void) | null
  /** True once this player has acknowledged. */
  isReady: boolean
  /** True for someone watching rather than playing this round. */
  isSpectator: boolean
}

/** Who has acknowledged the round, and this player's own acknowledgement. */
export function ReadyCheck({
  waitingFor,
  readyCount,
  participantCount,
  onReady,
  isReady,
  isSpectator,
}: ReadyCheckProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      {onReady && (
        <PushButton size="md" onClick={onReady}>
          I&rsquo;m ready
        </PushButton>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 30,
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
          {isSpectator
            ? 'You joined mid-run — you play from the next lobby.'
            : waitingFor.length > 0
              ? `Waiting on ${formatList(waitingFor)}.`
              : isReady
                ? 'Everyone is in. Starting…'
                : 'Everyone else is in.'}
        </div>
      </div>
    </div>
  )
}
