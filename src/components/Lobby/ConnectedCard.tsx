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
  /** Percentage offsets and animation timings, precomputed by the layout. */
  left: string
  top: string
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

/** The pegboard everyone's avatar drifts around while the room fills up. */
export function ConnectedCard({ floaters, emptyLine, selfId, onKick }: ConnectedCardProps) {
  // A phone-width card fits four across only if each avatar gives up some size.
  const compact = useMediaQuery(breakpoint.compact)
  const block = compact ? 68 : 82

  return (
    <div
      style={{
        ...sharedStyles.bigCard,
        flex: 1,
        minHeight: fluid(240, 280),
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
        floaters.map((floater) => (
          <div
            key={floater.id}
            style={{
              position: 'absolute',
              left: floater.left,
              top: floater.top,
              marginLeft: -block / 2,
              marginTop: -block / 2,
              width: block,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              animation: `pa-float ${floater.duration} ease-in-out infinite`,
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
                maxWidth: compact ? 72 : 110,
                ...sharedStyles.ellipsis,
              }}
            >
              {floater.name}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
