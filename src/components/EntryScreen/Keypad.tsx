import { useHover } from '../../hooks/index.ts'
import { border, color, font } from '../../theme/index.ts'

interface KeypadProps {
  /** The room-code alphabet, straight from the server's constants. */
  alphabet: string
  disabled: boolean
  onPress: (char: string) => void
  onDelete: () => void
}

/** On-screen keys, so the arena needs no keyboard. */
export function Keypad({ alphabet, disabled, onPress, onDelete }: KeypadProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
      {[...alphabet].map((char) => (
        <Key
          key={char}
          label={char}
          disabled={disabled}
          onPress={() => { onPress(char) }}
        />
      ))}
      <Key label="DEL" disabled={disabled} destructive onPress={onDelete} />
    </div>
  )
}

interface KeyProps {
  label: string
  disabled: boolean
  destructive?: boolean
  onPress: () => void
}

function Key({ label, disabled, destructive = false, onPress }: KeyProps) {
  const [hovered, handlers] = useHover()

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      {...handlers}
      style={{
        padding: '9px 0',
        textAlign: 'center',
        border: border.medium,
        borderRadius: 10,
        background: destructive
          ? color.pinkSoft
          : hovered && !disabled
            ? color.yellowSoft
            : color.white,
        color: color.ink,
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: 15,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  )
}
