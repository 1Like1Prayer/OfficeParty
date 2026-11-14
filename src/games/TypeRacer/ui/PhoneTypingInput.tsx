import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { border, color, font } from '../../../theme/index.ts'
import { TYPING_INPUT_ATTRIBUTE } from '../typing/keys.ts'

export interface PhoneTypingInputHandle {
  /** Brings the keyboard up, as a tap on the sheet does. */
  focus: () => void
}

interface PhoneTypingInputProps {
  /** Each character the keyboard types, in order. */
  onCharacter: (key: string) => void
  /** Typing is open: the box invites a tap. Closed (a roll, a break), it waits quietly but keeps the keyboard up. */
  isOpen: boolean
}

/**
 * A phone's way in: a slim box that brings up the on-screen keyboard. Phone
 * keyboards often do not report key presses at all, so what they type is read
 * from what lands in the box, character by character, and the box is emptied
 * as it goes. Deleting does nothing, as on a real keyboard: a typo stands.
 *
 * Autocorrect, capitals and suggestions are all off, so the keyboard types
 * exactly what is pressed. The text is 16px, as anything smaller makes an
 * iPhone zoom the page on tap.
 */
export const PhoneTypingInput = forwardRef<PhoneTypingInputHandle, PhoneTypingInputProps>(
  function PhoneTypingInput({ onCharacter, isOpen }, ref) {
    const inputRef = useRef<HTMLInputElement>(null)
    /** What the box held after the last change, so only what was added counts. */
    const seen = useRef('')
    const isComposing = useRef(false)
    const [isFocused, setIsFocused] = useState(false)

    useImperativeHandle(ref, () => ({ focus: () => { inputRef.current?.focus() } }), [])

    const clear = () => {
      if (inputRef.current) inputRef.current.value = ''
      seen.current = ''
    }

    const take = (value: string) => {
      // Only what was added since last time; a deletion adds nothing.
      const added = value.startsWith(seen.current) ? value.slice(seen.current.length) : ''
      seen.current = value
      for (const key of added) onCharacter(key)
      // Mid-word on a keyboard that composes, emptying the box would confuse it; wait for the word to end.
      if (!isComposing.current) clear()
    }

    return (
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          height: 40,
          borderRadius: 12,
          border: border.medium,
          background: isFocused ? color.white : color.yellowSoft,
          boxShadow: `0 3px 0 ${color.ink}`,
          cursor: 'text',
        }}
      >
        <span aria-hidden style={{ fontSize: 18 }}>⌨️</span>
        <input
          ref={inputRef}
          {...{ [TYPING_INPUT_ATTRIBUTE]: '' }}
          aria-label="Type here"
          placeholder={isFocused ? (isOpen ? 'Typing…' : 'Hold on…') : 'Tap here to type'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="next"
          onFocus={() => { setIsFocused(true) }}
          onBlur={() => { setIsFocused(false) }}
          onCompositionStart={() => { isComposing.current = true }}
          onCompositionEnd={(event) => {
            isComposing.current = false
            take(event.currentTarget.value)
          }}
          onChange={(event) => { take(event.currentTarget.value) }}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: font.body,
            fontWeight: 700,
            fontSize: 16,
            color: color.ink,
            // The typed letters vanish as they are taken, so the caret is all there is to see.
            caretColor: color.red,
          }}
        />
      </label>
    )
  },
)
