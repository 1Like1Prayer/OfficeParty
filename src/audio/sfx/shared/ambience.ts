import { sound } from '../core/sound.ts'

/**
 * Sounds of the world around a game, scattered at random over its loops
 * (see `useAmbientCalls`): things that call out now and then rather than hum.
 * They play on the `ambience` channel, which has its own volume. The loops
 * themselves (sea, wind) are in shared/ambience/ too, and are started by the
 * games that use them.
 */
export const ambience = {
  /**
   * A gull, somewhere off to one side: two to four cries, each a little lower
   * and quieter than the last, now and then answered by a second, further one.
   */
  seagulls: sound('shared/ambience/seagulls', { channel: 'ambience', gate: 'ambience.gulls', minGapMs: 2500 }),
} as const
