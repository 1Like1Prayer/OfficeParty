import { useState } from 'react'
import { avatarUrl } from '../../../content/avatars.ts'
import { color } from '../../../theme/index.ts'

interface AvatarProps {
  /** Single character, normally the player's initial. */
  initial: string
  /** Player swatch colour, which shows through the artwork. */
  background: string
  /** The player's chosen seed. Falsy or unreachable falls back to the initial. */
  seed?: string
  size?: number
  /** Thick outline, as the lobby's floating avatars have. */
  outlined?: boolean
}

/**
 * Colour tile carrying a player's avatar.
 *
 * The initial sits underneath the artwork rather than instead of it: DiceBear
 * is a third-party service, so an offline room, a blocked request or a slow
 * response degrades to the letter instead of an empty square.
 */
export function Avatar({
  initial,
  background,
  seed,
  size = 38,
  outlined = false,
}: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const radius = outlined ? 999 : Math.round(size * 0.29)

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius,
        background,
        border: outlined ? `4px solid ${color.ink}` : undefined,
        color: color.ink,
        fontWeight: 900,
        fontSize: Math.round(size * 0.42),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {initial}
      {seed && !broken && (
        <img
          src={avatarUrl(seed, size)}
          alt=""
          onError={() => { setBroken(true) }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
    </div>
  )
}
