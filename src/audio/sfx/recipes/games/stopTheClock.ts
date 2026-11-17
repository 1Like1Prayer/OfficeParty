import { arpeggio, noise, NOTE, strike, tone } from '../synth.ts'
import { oneShot, type Recipes } from '../types.ts'

/** Stop the Clock: the target roll, the running stopwatch, the stop, and how close it was. */

export const stopTheClockRecipes: Recipes = {
  /** One number flicking past in the target roll: a slot-machine clack. */
  rollClack: oneShot((v) => {
    noise(v, { duration: 0.03, gain: 0.16, filter: { type: 'bandpass', freq: 2200, q: 3 } })
    tone(v, { freq: 600, duration: 0.03, gain: 0.08, type: 'square' })
  }, { variants: 3 }),

  /** The roll landing on the real target: a heavy clunk and a bell. */
  rollLand: oneShot((v) => {
    tone(v, { freq: 180, to: 70, duration: 0.18, gain: 0.4, type: 'sine' })
    noise(v, { duration: 0.08, gain: 0.2, filter: { type: 'lowpass', freq: 1200 } })
    strike(v, NOTE.E6, { delay: 0.04, duration: 0.6, gain: 0.16 })
  }),

  /** STOP: a hard mechanical click. */
  stop: oneShot((v) => {
    noise(v, { duration: 0.04, gain: 0.35, filter: { type: 'bandpass', freq: 3000, q: 2 } })
    tone(v, { freq: 240, to: 90, duration: 0.12, gain: 0.4, type: 'square', filter: { type: 'lowpass', freq: 1200 } })
    strike(v, 1800, { delay: 0.02, duration: 0.3, gain: 0.08 })
  }),

  /** Someone else locked in: a quiet blip. */
  otherLockedIn: oneShot((v) => {
    tone(v, { freq: 1200, duration: 0.06, gain: 0.08, type: 'triangle' })
  }),

  /** Closest of anyone to the target: a bright bullseye ding. */
  bullseye: oneShot((v) => {
    strike(v, NOTE.C6, { duration: 1.0, gain: 0.25, ratios: [1, 2, 3, 4.2] })
    arpeggio(v, [NOTE.E6, NOTE.G6, NOTE.C7], 0.05, { delay: 0.05, duration: 0.2, gain: 0.08, type: 'sine' })
  }),

  /** Furthest off: a deflating womp. */
  womp: oneShot((v) => {
    tone(v, { freq: 330, to: 140, duration: 0.6, gain: 0.25, type: 'sawtooth', filter: { type: 'lowpass', freq: 900 }, vibrato: { rate: 7, depth: 0.03 } })
  }),

  tick: oneShot((v) => {
    noise(v, { duration: 0.02, gain: 0.14, filter: { type: 'bandpass', freq: 4200, q: 6 } })
    tone(v, { freq: 2600, duration: 0.015, gain: 0.05, type: 'square' })
  }),
}
