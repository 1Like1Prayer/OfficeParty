import { droneLoop, layeredLoop, noise, noiseLoop, strike, tone } from '../synth.ts'
import { loop, LOW_RATE, oneShot, type Recipes } from '../types.ts'

/** Crusher Escalator: climbing, missing, the black hole's hunger, and being swallowed. */

export const crusherEscalatorRecipes: Recipes = {
  /** A wrong arrow: a metallic clank. */
  wrong: oneShot((v) => {
    strike(v, 420, { duration: 0.3, gain: 0.25, ratios: [1, 1.71, 2.53, 3.4], type: 'square' })
    noise(v, { duration: 0.06, gain: 0.15, filter: { type: 'bandpass', freq: 1500, q: 2 } })
  }),

  /** The elimination gap narrowing: a warning double pip. */
  gapNarrows: oneShot((v) => {
    tone(v, { freq: 1100, duration: 0.08, gain: 0.18, type: 'square', filter: { type: 'lowpass', freq: 3000 } })
    tone(v, { freq: 1100, delay: 0.12, duration: 0.08, gain: 0.18, type: 'square', filter: { type: 'lowpass', freq: 3000 } })
  }),

  /** Swallowed by the black hole: a long sucking dive into the dark. */
  swallowed: oneShot((v) => {
    tone(v, { freq: 900, to: 35, duration: 1.4, gain: 0.35, type: 'sawtooth', filter: { type: 'lowpass', freq: 2500, to: 200 } })
    noise(v, { duration: 1.3, attack: 0.1, gain: 0.25, filter: { type: 'bandpass', freq: 3000, to: 120, q: 2 } })
    tone(v, { freq: 55, delay: 1.0, duration: 0.8, gain: 0.4, type: 'sine' })
  }),

  step: oneShot((v) => {
    tone(v, { freq: 200, to: 90, duration: 0.09, gain: 0.35, type: 'sine' })
    noise(v, { duration: 0.03, gain: 0.12, filter: { type: 'bandpass', freq: 1200, q: 2 } })
    tone(v, { freq: 660, duration: 0.05, gain: 0.08, type: 'triangle' })
  }, { variants: 2 }),

  /** The black hole's hum. Played louder and higher (faster) as anyone nears the edge. 10 s: whole cycles of both its wobbles. */
  blackHole: loop(layeredLoop(
    droneLoop({ freqs: [41, 41.6, 82], type: 'sawtooth', filter: { type: 'lowpass', freq: 220, q: 3 }, pulse: { rate: 0.7, depth: 0.5 }, gain: 0.3 }),
    noiseLoop({ filter: { type: 'lowpass', freq: 180 }, swell: { rate: 0.3, depth: 0.5 }, gain: 0.2, rate: 0.5 }),
  ), 10, LOW_RATE),

  /** The escalator's machinery. */
  escalator: loop(droneLoop({ freqs: [98, 147], type: 'square', filter: { type: 'lowpass', freq: 300 }, pulse: { rate: 4, depth: 0.4 }, gain: 0.12 }), 5, LOW_RATE),
}
