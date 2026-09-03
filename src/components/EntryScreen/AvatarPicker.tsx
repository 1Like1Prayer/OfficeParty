import { AVATAR_SEEDS, avatarUrl } from '../../content/avatars.ts'
import { useHover } from '../../hooks/index.ts'
import { border, color, sharedStyles } from '../../theme/index.ts'

interface AvatarPickerProps {
  value: string
  onChange: (seed: string) => void
}

/** Pick the face everyone else will see floating in the lobby. */
export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={sharedStyles.microLabel}>PICK YOUR FACE</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 8,
        }}
      >
        {AVATAR_SEEDS.map((seed) => (
          <AvatarOption
            key={seed}
            seed={seed}
            selected={seed === value}
            onSelect={onChange}
          />
        ))}
      </div>
    </div>
  )
}

interface AvatarOptionProps {
  seed: string
  selected: boolean
  onSelect: (seed: string) => void
}

function AvatarOption({ seed, selected, onSelect }: AvatarOptionProps) {
  const [hovered, handlers] = useHover()

  return (
    <button
      type="button"
      onClick={() => { onSelect(seed) }}
      aria-label={`Avatar ${seed}`}
      aria-pressed={selected}
      {...handlers}
      style={{
        aspectRatio: '1',
        padding: 2,
        borderRadius: 999,
        border: selected ? border.heavy : border.thin,
        background: selected ? color.yellow : hovered ? color.yellowSoft : color.white,
        cursor: 'pointer',
        transform: hovered && !selected ? 'translateY(-2px)' : 'none',
        transition: 'transform .1s ease, background .12s ease',
      }}
    >
      <img
        src={avatarUrl(seed, 48)}
        alt=""
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </button>
  )
}
