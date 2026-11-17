import { arpeggio, noise, NOTE, tone } from '../synth.ts'
import { oneShot, type Recipes } from '../types.ts'

/** Cube Counter: the flash, the hide, typing the count, and right or wrong. */

/** Phone-keypad tone pairs, one per digit, so typing a number sounds like dialling it. */
const DTMF: Record<string, [number, number]> = {
  1: [697, 1209], 2: [697, 1336], 3: [697, 1477],
  4: [770, 1209], 5: [770, 1336], 6: [770, 1477],
  7: [852, 1209], 8: [852, 1336], 9: [852, 1477],
  0: [941, 1336],
}

export const cubeCounterRecipes: Recipes = {
  /** The blocks flash up: a camera shutter. */
  flash: oneShot((v) => {
    noise(v, { duration: 0.05, gain: 0.25, filter: { type: 'highpass', freq: 3000 } })
    noise(v, { delay: 0.06, duration: 0.04, gain: 0.18, filter: { type: 'bandpass', freq: 2000, q: 2 } })
    tone(v, { freq: 3200, duration: 0.25, gain: 0.04, type: 'sine' })
  }),

  /** The blocks vanish: a falling whoop. */
  hide: oneShot((v) => {
    tone(v, { freq: 900, to: 260, duration: 0.22, gain: 0.22, type: 'sine' })
  }),

  /** The answer clock running out: ticks, quickening. */
  tick: oneShot((v) => {
    tone(v, { freq: 1500, duration: 0.03, gain: 0.1, type: 'square', filter: { type: 'lowpass', freq: 3500 } })
  }),

  /** Right: a rising chime. */
  correct: oneShot((v) => {
    arpeggio(v, [NOTE.E5, NOTE.G5, NOTE.C6], 0.07, { duration: 0.28, gain: 0.25, type: 'triangle' })
  }),

  /** Wrong: a short buzzer. */
  wrong: oneShot((v) => {
    tone(v, { freq: 130, duration: 0.35, gain: 0.3, type: 'sawtooth', filter: { type: 'lowpass', freq: 1100 } })
    tone(v, { freq: 137, duration: 0.35, gain: 0.22, type: 'square', filter: { type: 'lowpass', freq: 900 } })
  }),

  /** Out of time with no answer: a lower, longer buzzer. */
  timeout: oneShot((v) => {
    tone(v, { freq: 98, duration: 0.6, gain: 0.32, type: 'sawtooth', filter: { type: 'lowpass', freq: 800 } })
    tone(v, { freq: 104, duration: 0.6, gain: 0.22, type: 'square', filter: { type: 'lowpass', freq: 700 } })
  }),

  /** The "next puzzle" card counting in: a blip per second. */
  nextBlip: oneShot((v) => {
    tone(v, { freq: 880, duration: 0.08, gain: 0.16, type: 'triangle' })
  }),

  /** A cube hopping in the intro: a cartoon boing. */
  hop: oneShot((v) => {
    tone(v, { freq: 180, to: 520, duration: 0.18, gain: 0.2, type: 'sine', vibrato: { rate: 30, depth: 0.04 } })
  }),

  /** One per digit: digit0 … digit9. */
  ...Object.fromEntries(
    Object.entries(DTMF).map(([digit, [low, high]]) => [
      `digit${digit}`,
      oneShot((v) => {
        tone(v, { freq: low, duration: 0.09, gain: 0.12, type: 'sine' })
        tone(v, { freq: high, duration: 0.09, gain: 0.12, type: 'sine' })
      }),
    ]),
  ),
}
