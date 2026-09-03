import { color, font } from '../../theme/index.ts'
import { Avatar } from '../ui/index.ts'

interface PlayerLightsProps {
  lights: {
    id: string
    initial: string
    color: string
    avatar: string
    active: boolean
  }[]
}

/**
 * Live progress. Games only ever report display-only signals — for Stop the
 * Clock that is "this player's clock is running", never their elapsed time.
 */
export function PlayerLights({ lights }: PlayerLightsProps) {
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
      {lights.map((light) => (
        <div
          key={light.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            opacity: light.active ? 1 : 0.35,
            transition: 'opacity .2s ease',
          }}
        >
          <Avatar initial={light.initial} background={light.color} seed={light.avatar} size={54} />
          <div
            style={{
              fontFamily: font.mono,
              fontSize: 11,
              letterSpacing: '0.12em',
              color: color.mutedStrong,
            }}
          >
            {light.active ? 'RUNNING' : 'STOPPED'}
          </div>
        </div>
      ))}
    </div>
  )
}
