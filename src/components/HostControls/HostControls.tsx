import { border, color, lift, sharedStyles } from '../../theme/index.ts'
import { ConfirmButton } from '../ui/index.ts'

interface HostControlsProps {
  /** On the last game, skipping goes straight to the final scores. */
  isLastGame: boolean
  onSkipGame: () => void
  onBackToLobby: () => void
}

/**
 * The owner's controls during a run. Shown only while a game is being
 * introduced, beside the host's own ready check — never over the game itself
 * or the results, where they would only be in the way.
 */
export function HostControls({
  isLastGame,
  onSkipGame,
  onBackToLobby,
}: HostControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Host controls"
      style={{
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 10px',
        background: color.panel,
        border: border.medium,
        borderRadius: 16,
        boxShadow: lift(4),
      }}
    >
      <span style={{ ...sharedStyles.microLabel, color: color.ink }}>HOST</span>
      <ConfirmButton
        label={isLastGame ? 'Final scores ⏭' : 'Next game ⏭'}
        confirmLabel={isLastGame ? 'End the run?' : 'Skip this game?'}
        onConfirm={onSkipGame}
      />
      <ConfirmButton
        label="Back to lobby"
        confirmLabel="End the run?"
        tone="danger"
        onConfirm={onBackToLobby}
      />
    </div>
  )
}
