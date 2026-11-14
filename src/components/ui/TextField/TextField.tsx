import { border, color, fluid, font } from '../../../theme/index.ts'

interface TextFieldProps {
  value: string
  placeholder: string
  maxLength: number
  /** Focus on mount — the entrance screens have one obvious next action. */
  autoFocus?: boolean
  onChange: (value: string) => void
  onSubmit?: () => void
}

/** The chunky outlined input the entrance screens are built from. */
export function TextField({
  value,
  placeholder,
  maxLength,
  autoFocus = false,
  onChange,
  onSubmit,
}: TextFieldProps) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus={autoFocus}
      onChange={(event) => { onChange(event.target.value) }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        // Releasing focus lets whatever comes next take the keyboard — on the
        // join card that is the room code.
        event.currentTarget.blur()
        onSubmit?.()
      }}
      style={{
        width: '100%',
        border: border.heavy,
        borderRadius: fluid(12, 16),
        padding: `${fluid(10, 14)} ${fluid(14, 18)}`,
        background: color.white,
        color: color.ink,
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: fluid(22, 30),
        minWidth: 0,
        outline: 'none',
      }}
    />
  )
}
