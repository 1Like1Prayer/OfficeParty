import { arpeggio, chord, droneLoop, layeredLoop, noise, noiseLoop, NOTE, tone } from '../synth.ts'
import { loop, oneShot, type Recipes } from '../types.ts'

/** Mage Battle: casting, fizzling, the beams' clash, and mages knocked out. */

export const mageBattleRecipes: Recipes = {
  /** A miss, or a spin gone by unpressed: the spell sputters. */
  fizzle: oneShot((v) => {
    noise(v, { duration: 0.3, gain: 0.25, filter: { type: 'highpass', freq: 1800, to: 600 } })
    tone(v, { freq: 400, to: 120, duration: 0.25, gain: 0.15, type: 'sawtooth', filter: { type: 'lowpass', freq: 1200 } })
  }),

  /** A press this spin already had: a dud click. */
  spent: oneShot((v) => {
    tone(v, { freq: 300, duration: 0.04, gain: 0.1, type: 'square', filter: { type: 'lowpass', freq: 1200 } })
  }),

  /** A mage's beam firing for the first time. */
  beamFire: oneShot((v) => {
    tone(v, { freq: 200, to: 1400, duration: 0.35, gain: 0.18, type: 'sawtooth', filter: { type: 'lowpass', freq: 3500 } })
    noise(v, { duration: 0.3, gain: 0.1, filter: { type: 'bandpass', freq: 3000, q: 1 } })
  }),

  /** A mage knocked out: a magic shatter. */
  knockedOut: oneShot((v) => {
    for (let index = 0; index < 10; index++) {
      tone(v, { freq: 2000 + Math.random() * 4000, delay: Math.random() * 0.25, duration: 0.25, gain: 0.06, type: 'sine' })
    }
    noise(v, { duration: 0.5, gain: 0.25, filter: { type: 'highpass', freq: 2500, to: 800 } })
    tone(v, { freq: 600, to: 80, duration: 0.8, gain: 0.25, type: 'sawtooth', filter: { type: 'lowpass', freq: 1500 } })
  }, { variants: 2 }),

  /** Last mage standing. */
  win: oneShot((v) => {
    arpeggio(v, [NOTE.D5, NOTE.F5 * 1.06, NOTE.A5, NOTE.D6], 0.08, { duration: 0.25, gain: 0.22, type: 'triangle' })
    chord(v, [NOTE.D5, NOTE.A5, NOTE.D6], { delay: 0.32, duration: 1.1, gain: 0.25, type: 'sawtooth', filter: { type: 'lowpass', freq: 2200 }, vibrato: { rate: 5, depth: 0.01 } })
  }),

  cast: oneShot((v) => {
    tone(v, { freq: 300, to: 1200, duration: 0.25, gain: 0.25, type: 'sawtooth', filter: { type: 'lowpass', freq: 4000 } })
    tone(v, { freq: 600, to: 2400, duration: 0.2, gain: 0.1, type: 'sine' })
    noise(v, { duration: 0.35, gain: 0.2, filter: { type: 'bandpass', freq: 2500, to: 800, q: 1 } })
    tone(v, { freq: 80, to: 40, delay: 0.1, duration: 0.3, gain: 0.3, type: 'sine' })
  }, { variants: 2 }),

  sparkle: oneShot((v) => {
    for (let index = 0; index < 6; index++) {
      tone(v, { freq: 3000 + Math.random() * 2500, delay: 0.12 + index * 0.04, duration: 0.1, gain: 0.05, type: 'sine' })
    }
  }, { variants: 2 }),

  /** The beams locked in the middle: an electric hum. 4 s: whole cycles of its pulse and crackle. */
  beam: loop(layeredLoop(
    droneLoop({ freqs: [55, 110, 111.5], type: 'sawtooth', filter: { type: 'lowpass', freq: 700, q: 4 }, pulse: { rate: 9, depth: 0.3 }, gain: 0.3 }),
    noiseLoop({ filter: { type: 'bandpass', freq: 4000, q: 1.5 }, swell: { rate: 7, depth: 0.6 }, gain: 0.06 }),
  ), 4),
}
