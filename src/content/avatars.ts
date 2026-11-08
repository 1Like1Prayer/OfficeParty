/**
 * Avatars come from DiceBear, drawn from a seed the player picks.
 *
 * Only the seed travels over the wire (see `AVATAR` in shared/constants) — the
 * URL is built here, so no one can point the room's browsers at an address of
 * their choosing. The server validates the seed against the same alphabet.
 */

const DICEBEAR = 'https://api.dicebear.com/9.x'

/** One style for everyone, so a room of avatars reads as a set. */
const STYLE = 'adventurer'

/** The seeds on offer. Short, so they fit the wire format comfortably. */
export const AVATAR_SEEDS = [
  'pickle',
  'stapler',
  'mug',
  'cactus',
  'lamp',
  'toaster',
  'ficus',
  'kettle',
  'clipboard',
  'donut',
  'cable',
  'mousepad',
] as const

export type AvatarSeed = (typeof AVATAR_SEEDS)[number]

/**
 * The image for a seed. `backgroundColor=transparent` lets the player's colour
 * tile show through, so the swatch keeps doing the identifying at small sizes.
 */
export function avatarUrl(seed: string, size: number): string {
  const params = new URLSearchParams({
    seed,
    size: String(Math.max(32, Math.round(size * 2))),
    backgroundColor: 'transparent',
    radius: '0',
  })
  return `${DICEBEAR}/${STYLE}/svg?${params.toString()}`
}

/** A seed to start on, so nobody has to choose before they can play. */
export function randomSeed(): AvatarSeed {
  return AVATAR_SEEDS[Math.floor(Math.random() * AVATAR_SEEDS.length)]
}
