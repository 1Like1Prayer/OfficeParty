import { color } from '../../../theme/index.ts'

interface AvatarProps {
  /** Single character, normally the player's initial. */
  initial: string
  /** Player swatch colour. */
  background: string
  size?: number
}

/** Square colour tile carrying a player's initial. */
export function Avatar({ initial, background, size = 38 }: AvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: Math.round(size * 0.29),
        background,
        color: color.ink,
        fontWeight: 900,
        fontSize: Math.round(size * 0.42),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {initial}
    </div>
  )
}
