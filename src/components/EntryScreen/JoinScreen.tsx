import { useEffect } from 'react'
import { ROOM } from '../../shared/constants.ts'
import { color, sharedStyles } from '../../theme/index.ts'
import { PushButton, TextField } from '../ui/index.ts'
import { CodeBoxes } from './CodeBoxes.tsx'
import { EntryCard } from './EntryCard.tsx'
import { Keypad } from './Keypad.tsx'

interface JoinScreenProps {
  name: string
  code: string
  error: string | null
  busy: boolean
  onName: (name: string) => void
  onPressKey: (char: string) => void
  onPasteCode: (text: string) => void
  onDeleteKey: () => void
  onJoin: () => void
  onBack: () => void
}

/**
 * The code can be typed or tapped: desktops have keyboards, and a phone in the
 * room should not need one.
 */
function useTypedCode(
  enabled: boolean,
  onPressKey: (char: string) => void,
  onPasteCode: (text: string) => void,
  onDeleteKey: () => void,
) {
  useEffect(() => {
    if (!enabled) return

    // A field has the keyboard, so leave typing and pasting to it.
    const inField = () => document.activeElement instanceof HTMLInputElement

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (inField()) return

      if (event.key === 'Backspace') {
        event.preventDefault()
        onDeleteKey()
        return
      }
      const char = event.key.toUpperCase()
      if (char.length === 1 && ROOM.CODE_ALPHABET.includes(char)) {
        event.preventDefault()
        onPressKey(char)
      }
    }

    const onPaste = (event: ClipboardEvent) => {
      if (inField()) return
      const text = event.clipboardData?.getData('text')
      if (!text) return
      event.preventDefault()
      onPasteCode(text)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('paste', onPaste)
    }
  }, [enabled, onPressKey, onPasteCode, onDeleteKey])
}

export function JoinScreen({
  name,
  code,
  error,
  busy,
  onName,
  onPressKey,
  onPasteCode,
  onDeleteKey,
  onJoin,
  onBack,
}: JoinScreenProps) {
  useTypedCode(!busy, onPressKey, onPasteCode, onDeleteKey)
  const ready = name.trim().length > 0 && code.length === ROOM.CODE_LENGTH && !busy

  return (
    <EntryCard label="JOIN A PARTY" onBack={onBack}>
      <div style={{ ...sharedStyles.displayHeading, fontSize: 38, lineHeight: 1.05 }}>
        Name yourself, then the code
      </div>
      <div style={sharedStyles.microLabel}>NAME, THEN ENTER — THEN TYPE OR PASTE THE CODE</div>
      <TextField
        value={name}
        placeholder="Your name"
        maxLength={ROOM.MAX_NAME_LENGTH}
        autoFocus
        onChange={onName}
      />
      <CodeBoxes entry={code} length={ROOM.CODE_LENGTH} invalid={error !== null} />
      {error && (
        <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: '0.12em', color: color.red }}>
          {error.toUpperCase()}
        </div>
      )}
      <div style={{ ...sharedStyles.microLabel, marginTop: -6 }}>TYPE, PASTE, OR TAP BELOW</div>
      <Keypad
        alphabet={ROOM.CODE_ALPHABET}
        disabled={busy}
        onPress={onPressKey}
        onDelete={onDeleteKey}
      />
      <PushButton size="sm" onClick={onJoin} disabled={!ready}>
        {busy ? 'Joining…' : 'Join the party'}
      </PushButton>
    </EntryCard>
  )
}
