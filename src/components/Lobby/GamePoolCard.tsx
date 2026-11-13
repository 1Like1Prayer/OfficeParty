import { useHover } from '../../hooks/index.ts'
import { border, color, fluid, sharedStyles } from '../../theme/index.ts'

export interface PoolChipView {
  id: string
  name: string
  selected: boolean
  /** Games the server has no module for yet cannot go in a playlist. */
  playable: boolean
}

interface GamePoolCardProps {
  chips: PoolChipView[]
  toggleAllLabel: string
  /** Only the room owner may change the pool. */
  readOnly: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
}

/** Which games the run draws from. Unbuilt games are shown but not selectable. */
export function GamePoolCard({
  chips,
  toggleAllLabel,
  readOnly,
  onToggle,
  onToggleAll,
}: GamePoolCardProps) {
  return (
    <div
      style={{
        ...sharedStyles.bigCard,
        flex: 1,
        minHeight: 0,
        padding: `${fluid(16, 24)} ${fluid(16, 28)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: fluid(12, 18),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={sharedStyles.microLabel}>GAME POOL</div>
        {!readOnly && (
          <button type="button" onClick={onToggleAll} style={sharedStyles.inlineAction}>
            {toggleAllLabel}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: fluid(8, 10), flexWrap: 'wrap', alignContent: 'flex-start' }}>
        {chips.map((chip) => (
          <PoolChip key={chip.id} chip={chip} readOnly={readOnly} onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}

interface PoolChipProps {
  chip: PoolChipView
  readOnly: boolean
  onToggle: (id: string) => void
}

function PoolChip({ chip, readOnly, onToggle }: PoolChipProps) {
  const [hovered, handlers] = useHover()
  const locked = readOnly || !chip.playable

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => { onToggle(chip.id) }}
      {...handlers}
      title={chip.playable ? undefined : 'Not built yet'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: fluid(7, 9),
        padding: `${fluid(9, 11)} ${fluid(13, 18)}`,
        maxWidth: '100%',
        textAlign: 'left',
        borderRadius: 999,
        border: border.medium,
        background: chip.selected
          ? color.yellowSoft
          : hovered && chip.playable
            ? color.panel
            : color.white,
        color: chip.selected ? color.ink : color.mutedSoft,
        fontWeight: 900,
        fontSize: fluid(14, 15),
        cursor: locked ? 'default' : 'pointer',
        opacity: chip.playable ? 1 : 0.55,
        borderStyle: chip.playable ? 'solid' : 'dashed',
      }}
    >
      <span
        style={{
          width: 15,
          height: 15,
          flexShrink: 0,
          borderRadius: 5,
          border: border.thin,
          background: chip.selected ? color.pink : color.white,
        }}
      />
      <span>{chip.name}</span>
    </button>
  )
}
