import { sfxEngine, type Channel, type LoopSound, type PlayOptions } from './engine.ts'

/** A ready-to-play effect: call it, optionally overriding its defaults for this one play. */
export type Sound = (options?: PlayOptions) => void

/**
 * A sound file, by id (its path under src/assets/audio/sfx/ without `.wav`),
 * with defaults of its own: variation, gating, ducking, channel.
 */
export function sound(id: string, defaults: PlayOptions = {}): Sound {
  return (options = {}) => {
    sfxEngine.play(id, {
      ...defaults,
      ...options,
      volume: (defaults.volume ?? 1) * (options.volume ?? 1),
      pitch: (defaults.pitch ?? 1) * (options.pitch ?? 1),
    })
  }
}

/** A looping sound file, and the channel it plays on. Start it with `useLoop` or `sfxEngine.loop`. */
export function loopSound(id: string, channel: Channel = 'effects'): LoopSound {
  return { id, channel }
}
