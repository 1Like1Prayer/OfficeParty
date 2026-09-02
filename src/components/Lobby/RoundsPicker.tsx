import { useHover } from '../../hooks/index.ts'
import { border, color, font, sharedStyles } from '../../theme/index.ts'

interface RoundsPickerProps {
  value: number
  /** The server tells us what it will accept; we never invent options. */
  options: number[]
  onChange: (rounds: number) => void
}

/** Rounds per game. Owner-only on the server, and the arena is the owner. */
export function RoundsPicker({ value, options, onChange }: RoundsPickerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={sharedStyles.microLabel}>ROUNDS PER GAME</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {options.map((option) => (
          <RoundsOption
            key={option}
            option={option}
            selected={option === value}
            onSelect={onChange}
          />
        ))}
      </div>
    </div>
  )
}

interface RoundsOptionProps {
  option: number
  selected: boolean
  onSelect: (rounds: number) => void
}

function RoundsOption({ option, selected, onSelect }: RoundsOptionProps) {
  const [hovered, handlers] = useHover()

  return (
    <button
      type="button"
      onClick={() => { onSelect(option) }}
      {...handlers}
      style={{
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: 20,
        padding: '6px 20px',
        borderRadius: 999,
        border: border.medium,
        cursor: 'pointer',
        background: selected ? color.yellow : color.white,
        color: color.ink,
        transform: hovered && !selected ? 'translateY(-1px)' : 'none',
        transition: 'transform .1s ease',
      }}
    >
      {option}
    </button>
  )
}
