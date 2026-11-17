import { useMediaQuery } from '../../hooks/index.ts'
import { breakpoint, color, fluid, pegboard, sharedStyles } from '../../theme/index.ts'
import { Avatar, ConfirmButton } from '../ui/index.ts'

export interface Floater {
  id: string
  name: string
  initial: string
  color: string
  /** DiceBear seed the player picked. */
  avatar: string
  /** Animation timings, so the avatars drift out of step. */
  duration: string
  delay: string
}

interface ConnectedCardProps {
  floaters: Floater[]
  emptyLine: string
  selfId: string | null
  /** Set for the owner only: everyone else's avatar gets a remove button. */
  onKick: ((playerId: string) => void) | null
}

/** Room kept clear above and below the rows, for the label and the drift. */
const EDGE = 58
/** Each row of avatars needs this much height, drift included, so neighbours never cover a name. */
const ROW_HEIGHT = 112
/** Past this many, a wide card seats six to a row, so a full room of twelve is two rows. */
const CROWDED = 8

/**
 * Where avatar `index` of `total` sits: even rows, each centred. A phone
 * seats at most four to a row; a wide card takes six once it is crowded.
 */
function seatOf(index: number, total: number, compact: boolean) {
  const columns = total <= 2 ? total : total <= 6 ? 3 : !compact && total > CROWDED ? 6 : 4
  const rows = Math.max(1, Math.ceil(total / columns))
  const column = index % columns
  const row = Math.floor(index / columns)
  const inRow = Math.min(columns, total - row * columns)
  return {
    left: `${(100 / (inRow + 1)) * (column + 1)}%`,
    top: `calc(${EDGE}px + ${row} * (100% - ${EDGE * 2}px) / ${rows} + (100% - ${EDGE * 2}px) / ${rows * 2})`,
    rows,
  }
}

/** The pegboard everyone's avatar drifts around while the room fills up. */
export function ConnectedCard({ floaters, emptyLine, selfId, onKick }: ConnectedCardProps) {
  // A phone-width card fits four across only if each avatar gives up some size.
  const compact = useMediaQuery(breakpoint.compact)
  const block = compact ? 68 : 82
  const isCrowded = floaters.length > CROWDED
  const rows = floaters.length === 0 ? 1 : seatOf(0, floaters.length, compact).rows

  return (
    <div
      style={{
        ...sharedStyles.bigCard,
        flex: 1,
        // Tall enough for every row: a phone's full room is three rows of four.
        minHeight: `max(${fluid(240, 280)}, ${rows * ROW_HEIGHT + EDGE}px)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, ...pegboard(color.yellowSoft, 34) }} />
      <div style={{ ...sharedStyles.microLabel, position: 'absolute', top: fluid(14, 20), left: fluid(16, 26) }}>
        CONNECTED
      </div>

      {floaters.length === 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: fluid(24, 40),
            textAlign: 'center',
            fontWeight: 700,
            fontSize: fluid(16, 19),
            color: color.mutedStrong,
            animation: 'pa-pulse 2.4s ease-in-out infinite',
          }}
        >
          {emptyLine}
        </div>
      ) : (
        floaters.map((floater, index) => {
          const { left, top } = seatOf(index, floaters.length, compact)
          return (
          <div
            key={floater.id}
            style={{
              position: 'absolute',
              left,
              top,
              marginLeft: -block / 2,
              marginTop: -block / 2,
              width: block,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              // A crowded board drifts less, so neighbours keep clear of each other.
              animation: `${isCrowded ? 'pa-float-tight' : 'pa-float'} ${floater.duration} ease-in-out infinite`,
              animationDelay: floater.delay,
            }}
          >
            <div style={{ position: 'relative' }}>
              <Avatar
                initial={floater.initial}
                background={floater.color}
                seed={floater.avatar}
                size={compact ? 44 : 54}
                outlined
              />
              {onKick && floater.id !== selfId && (
                <ConfirmButton
                  badge
                  label="×"
                  title={`Remove ${floater.name}`}
                  confirmLabel="Remove?"
                  onConfirm={() => { onKick(floater.id) }}
                  style={{ position: 'absolute', top: -8, right: -14, zIndex: 1 }}
                />
              )}
            </div>
            <div
              style={{
                background: color.white,
                border: `2px solid ${color.ink}`,
                borderRadius: 999,
                padding: '1px 9px',
                fontWeight: 900,
                fontSize: compact ? 10 : 11,
                whiteSpace: 'nowrap',
                maxWidth: compact ? 72 : isCrowded ? 84 : 110,
                ...sharedStyles.ellipsis,
              }}
            >
              {floater.name}
            </div>
          </div>
          )
        })
      )}
    </div>
  )
}
