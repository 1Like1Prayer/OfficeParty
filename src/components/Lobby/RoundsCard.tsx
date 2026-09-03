import { useHover } from '../../hooks/index.ts'
import { border, color, font, sharedStyles } from '../../theme/index.ts'

interface RoundsCardProps {
  value: number
  /** The server tells us what it will accept; we never invent options. */
  options: number[]
  /** Only the room owner may change this. */
  readOnly: boolean
  onChange: (rounds: number) => void
}

/** Rounds per game. Owner-only on the server, and the arena is the owner. */
export function RoundsCard({ value, options, readOnly, onChange }: RoundsCardProps) {
  return (
    <div style={{ ...sharedStyles.bigCard, padding: '24px 28px' }}>
      <div style={{ ...sharedStyles.microLabel, marginBottom: 16 }}>ROUNDS PER GAME</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {options.map((option) => (
          <RoundsOption
            key={option}
            option={option}
            selected={option === value}
            readOnly={readOnly}
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
  readOnly: boolean
  onSelect: (rounds: number) => void
}

function RoundsOption({ option, selected, readOnly, onSelect }: RoundsOptionProps) {
  const [hovered, handlers] = useHover()

  return (
    <button
      type="button"
      onClick={() => { onSelect(option) }}
      disabled={readOnly}
      {...handlers}
      style={{
        minWidth: 78,
        textAlign: 'center',
        padding: '14px 20px',
        borderRadius: 16,
        border: border.heavy,
        background:
          selected ? color.pink : hovered && !readOnly ? color.yellowSoft : color.white,
        color: selected ? color.white : color.ink,
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: 30,
        cursor: readOnly ? 'default' : 'pointer',
        opacity: readOnly && !selected ? 0.5 : 1,
      }}
    >
      {option}
    </button>
  )
}
