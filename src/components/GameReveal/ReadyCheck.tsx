import type { ReactNode } from 'react'
import { formatList } from '../../selectors/index.ts'
import { useMediaQuery } from '../../hooks/index.ts'
import { breakpoint, color, fluid, font } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'
import { sfx } from '../../audio/sfx/index.ts'

interface ReadyCheckProps {
  waitingFor: string[]
  readyCount: number
  participantCount: number
  /** Toggles this player's ready; null when they are not in the round. */
  onReady: (() => void) | null
  /** True once this player has acknowledged. */
  isReady: boolean
  /** True for someone watching rather than playing this round. */
  isSpectator: boolean
  /** The host's controls, set beside the ready button. */
  hostControls?: ReactNode
}

/** This player's ready, as a toggle: "I'm ready", then "I'm ready ✓" to take it back. */
export function ReadyButton({ isReady, onToggle, fullWidth = false }: { isReady: boolean; onToggle: () => void; fullWidth?: boolean }) {
  return (
    <PushButton
      size="md"
      fullWidth={fullWidth}
      variant={isReady ? 'success' : 'primary'}
      silent
      onClick={() => {
        if (isReady) sfx.ui.unready()
        else sfx.ui.ready()
        onToggle()
      }}
    >
      {isReady ? 'I’m ready ✓' : 'I’m ready'}
    </PushButton>
  )
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

  // Stays up once pressed, so they can take it back until the start's count runs out.
  const button = onReady && <ReadyButton isReady={isReady} onToggle={onReady} fullWidth={compact} />

  const status = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
        // Beside the button the basis is a minimum width. Under the host's
        // controls it sits in a column, where a basis would be a height and
        // leave a tall empty gap, so there it takes its content's height.
        flex: hostControls ? 'none' : '1 1 220px',
      }}
    >
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
