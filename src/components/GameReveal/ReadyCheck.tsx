import type { ReactNode } from 'react'
import { formatList } from '../../selectors/index.ts'
import { useMediaQuery } from '../../hooks/index.ts'
import { breakpoint, color, fluid, font } from '../../theme/index.ts'
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
  /** The host's controls, set beside the ready button. */
  hostControls?: ReactNode
}

/** Who has acknowledged the round, and this player's own acknowledgement. */
export function ReadyCheck({
  waitingFor,
  readyCount,
  participantCount,
  onReady,
  isReady,
  isSpectator,
  hostControls,
}: ReadyCheckProps) {
  const compact = useMediaQuery(breakpoint.compact)

  const button = onReady && (
    <PushButton size="md" fullWidth={compact} onClick={onReady}>
      I&rsquo;m ready
    </PushButton>
  )

  const status = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: '1 1 220px' }}>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: fluid(22, 30),
          color: color.ink,
        }}
      >
        {readyCount} / {participantCount} ready
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: fluid(14, 15),
          color: color.mutedStrong,
          overflowWrap: 'break-word',
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
  )

  // The host's controls take the place beside the button, and the count moves
  // underneath, so the things the host can press sit together.
  if (hostControls) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: fluid(12, 16), minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: fluid(12, 20), flexWrap: 'wrap' }}>
          {button}
          {hostControls}
        </div>
        {status}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: fluid(14, 20), flexWrap: 'wrap' }}>
      {button}
      {status}
    </div>
  )
}
