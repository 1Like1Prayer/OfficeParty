import type { LoopBuilder, Voice } from './synth.ts'

/**
 * A recipe is how a sound was made: the synth code that `render.ts` plays
 * into an offline audio context and saves as a .wav under
 * src/assets/audio/sfx/. The game itself only ever plays those files.
 */

export type Synth = (v: Voice) => void

export interface OneShotRecipe {
  kind: 'one-shot'
  synth: Synth
  /**
   * How many takes to render (saved as name.v1.wav, name.v2.wav, …). For a
   * sound with randomness in it, or one heard over and over: a different
   * take is picked each time it plays.
   */
  variants: number
  /** Render in stereo, for a sound panned inside itself. Mono otherwise. */
  stereo: boolean
}

export interface LoopRecipe {
  kind: 'loop'
  build: LoopBuilder
  /** Length of the saved loop. Crossfaded end into start, so it repeats without a seam. */
  seconds: number
  /**
   * Sample rate to save it at. Loops are kept as .wav (see render.ts), so a
   * deep one with nothing high in it is saved at a lower rate to keep it small.
   */
  sampleRate?: number
}

export type Recipe = OneShotRecipe | LoopRecipe

/** A group's recipes, by name (the file name it is saved under). */
export type Recipes = Record<string, Recipe>

export function oneShot(synth: Synth, options: { variants?: number; stereo?: boolean } = {}): OneShotRecipe {
  return { kind: 'one-shot', synth, variants: options.variants ?? 1, stereo: options.stereo ?? false }
}

export function loop(build: LoopBuilder, seconds: number, options: { sampleRate?: number } = {}): LoopRecipe {
  return { kind: 'loop', build, seconds, sampleRate: options.sampleRate }
}

/** For a loop with nothing above a few kHz (sea, wind, rumbles): half the size, and nothing lost. */
export const LOW_RATE = { sampleRate: 16_000 } as const
