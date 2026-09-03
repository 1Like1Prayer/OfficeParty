import { color, pegboard, sharedStyles } from '../../theme/index.ts'
import { Avatar } from '../ui/index.ts'

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
}

/** The pegboard everyone's avatar drifts around while the room fills up. */
export function ConnectedCard({ floaters, emptyLine }: ConnectedCardProps) {
  return (
    <div
      style={{
        ...sharedStyles.bigCard,
        flex: 1,
        minHeight: 280,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, ...pegboard(color.yellowSoft, 34) }} />
      <div style={{ ...sharedStyles.microLabel, position: 'absolute', top: 20, left: 26 }}>
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
            padding: 40,
            textAlign: 'center',
            fontWeight: 700,
            fontSize: 19,
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
              marginLeft: -41,
              marginTop: -41,
              width: 82,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              animation: `pa-float ${floater.duration} ease-in-out infinite`,
              animationDelay: floater.delay,
            }}
          >
            <Avatar
              initial={floater.initial}
              background={floater.color}
              seed={floater.avatar}
              size={54}
              outlined
            />
            <div
              style={{
                background: color.white,
                border: `2px solid ${color.ink}`,
                borderRadius: 999,
                padding: '1px 9px',
                fontWeight: 900,
                fontSize: 11,
                whiteSpace: 'nowrap',
                maxWidth: 110,
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
