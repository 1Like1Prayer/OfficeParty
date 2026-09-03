import { useEffect, useRef } from 'react'
import { border, color, font } from '../../theme/index.ts'

interface CodeBoxesProps {
  entry: string
  length: number
  invalid: boolean
  /** Focus the code as soon as the name is done with the keyboard. */
  focused: boolean
  onChange: (text: string) => void
  onSubmit: () => void
}

/**
 * One box per character, backed by a real input laid transparently over them.
 * The boxes are the design; the input is what makes typing, pasting, mobile
 * keyboards and autofill work without any of it being reimplemented.
 */
export function CodeBoxes({
  entry,
  length,
  invalid,
  focused,
  onChange,
  onSubmit,
}: CodeBoxesProps) {
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focused) field.current?.focus()
  }, [focused])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {Array.from({ length }, (_, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              aspectRatio: '1',
              border: border.heavy,
              borderRadius: 14,
              background: invalid
                ? color.pinkSoft
                : entry[index]
                  ? color.yellowSoft
                  : color.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 40,
            }}
          >
            {entry[index] ?? ''}
          </div>
        ))}
      </div>
      <input
        ref={field}
        value={entry}
        maxLength={length}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-label="Room code"
        onChange={(event) => { onChange(event.target.value) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit()
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          // Invisible, but it is the thing actually being typed into, so it
          // must stay focusable and clickable rather than hidden.
          opacity: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'text',
        }}
      />
    </div>
  )
}
