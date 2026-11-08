import { ROOM } from '../../shared/constants.ts'
import { color, sharedStyles } from '../../theme/index.ts'
import { PushButton, TextField } from '../ui/index.ts'
import { AvatarPicker } from './AvatarPicker.tsx'
import { CodeBoxes } from './CodeBoxes.tsx'
import { EntryCard } from './EntryCard.tsx'

interface JoinScreenProps {
  name: string
  avatar: string
  code: string
  /** True once the name has been confirmed, which hands the code the keyboard. */
  nameDone: boolean
  error: string | null
  busy: boolean
  onName: (name: string) => void
  onAvatar: (seed: string) => void
  onNameDone: () => void
  onCode: (text: string) => void
  onJoin: () => void
  onBack: () => void
}

/** Name yourself and type the room code someone read out. */
export function JoinScreen({
  name,
  avatar,
  code,
  nameDone,
  error,
  busy,
  onName,
  onAvatar,
  onNameDone,
  onCode,
  onJoin,
  onBack,
}: JoinScreenProps) {
  const ready = name.trim().length > 0 && code.length === ROOM.CODE_LENGTH && !busy
  const submit = () => { if (ready) onJoin() }

  return (
    <EntryCard label="JOIN A PARTY" onBack={onBack}>
      <div style={{ ...sharedStyles.displayHeading, fontSize: 38, lineHeight: 1.05 }}>
        Name yourself, then the code
      </div>
      <TextField
        value={name}
        placeholder="Your name"
        maxLength={ROOM.MAX_NAME_LENGTH}
        autoFocus
        onChange={onName}
        onSubmit={onNameDone}
      />
      <AvatarPicker value={avatar} onChange={onAvatar} />
      <CodeBoxes
        entry={code}
        length={ROOM.CODE_LENGTH}
        invalid={error !== null}
        focused={nameDone}
        onChange={onCode}
        onSubmit={submit}
      />
      {error && (
        <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: '0.12em', color: color.red }}>
          {error.toUpperCase()}
        </div>
      )}
      <PushButton size="sm" onClick={submit} disabled={!ready}>
        {busy ? 'Joining…' : 'Join the party'}
      </PushButton>
      <div style={{ fontSize: 14, color: color.muted, fontWeight: 700 }}>
        Type or paste the code, then press Enter.
      </div>
    </EntryCard>
  )
}
