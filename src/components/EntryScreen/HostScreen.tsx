import { ROOM } from '../../shared/constants.ts'
import { color, sharedStyles } from '../../theme/index.ts'
import { PushButton, TextField } from '../ui/index.ts'
import { EntryCard } from './EntryCard.tsx'

interface HostScreenProps {
  name: string
  error: string | null
  busy: boolean
  onName: (name: string) => void
  onHost: () => void
  onBack: () => void
}

/** Name yourself, then open a room for everyone else to join. */
export function HostScreen({
  name,
  error,
  busy,
  onName,
  onHost,
  onBack,
}: HostScreenProps) {
  const ready = name.trim().length > 0 && !busy

  return (
    <EntryCard label="OPEN A PARTY" onBack={onBack}>
      <div style={{ ...sharedStyles.displayHeading, fontSize: 38, lineHeight: 1.05 }}>
        What should we call you?
      </div>
      <TextField
        value={name}
        placeholder="Your name"
        maxLength={ROOM.MAX_NAME_LENGTH}
        autoFocus
        onChange={onName}
        onSubmit={() => { if (ready) onHost() }}
      />
      {error && (
        <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: '0.12em', color: color.red }}>
          {error.toUpperCase()}
        </div>
      )}
      <PushButton onClick={onHost} disabled={!ready}>
        {busy ? 'Opening…' : 'Open the room'}
      </PushButton>
      <div style={{ fontSize: 15, color: color.muted, fontWeight: 700 }}>
        You&rsquo;ll get a code to share. {ROOM.MIN_PLAYERS} players minimum.
      </div>
    </EntryCard>
  )
}
