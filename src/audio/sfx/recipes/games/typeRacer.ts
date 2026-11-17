import { arpeggio, chord, noise, NOTE, rattle, strike, tone } from '../synth.ts'
import { oneShot, type Recipes } from '../types.ts'

/** Type Racer Roulette: the typewriter, the dice, and the board giving way. */

export const typeRacerRecipes: Recipes = {
  /** A correct key: a typewriter clack. */
  key: oneShot((v) => {
    noise(v, { duration: 0.035, gain: 0.3, filter: { type: 'bandpass', freq: 2800, q: 1.5 } })
    tone(v, { freq: 140, to: 80, duration: 0.05, gain: 0.22, type: 'sine' })
    noise(v, { delay: 0.012, duration: 0.02, gain: 0.1, filter: { type: 'highpass', freq: 5000 } })
  }, { variants: 4 }),

  /** A finished line: the carriage bell, then the return. */
  lineDone: oneShot((v) => {
    strike(v, NOTE.C7 * 0.95, { duration: 1.1, gain: 0.22, ratios: [1, 2.32, 4.25, 6.63] })
    noise(v, { delay: 0.18, duration: 0.35, attack: 0.05, gain: 0.18, filter: { type: 'bandpass', freq: 1200, to: 3000, q: 2 } })
    noise(v, { delay: 0.53, duration: 0.05, gain: 0.25, filter: { type: 'bandpass', freq: 1800, q: 2 } })
  }),

  /** A wrong key: the typebars jam with a clunk, and a strike buzzer. */
  jam: oneShot((v) => {
    noise(v, { duration: 0.06, gain: 0.35, filter: { type: 'lowpass', freq: 1400 } })
    strike(v, 310, { duration: 0.22, gain: 0.2, ratios: [1, 1.6, 2.3], type: 'square' })
    tone(v, { freq: 110, delay: 0.05, duration: 0.25, gain: 0.2, type: 'sawtooth', filter: { type: 'lowpass', freq: 700 } })
  }),

  /** A fresh sheet: paper sliding in. */
  newSheet: oneShot((v) => {
    noise(v, { duration: 0.5, attack: 0.08, gain: 0.3, filter: { type: 'bandpass', freq: 1500, to: 4500, q: 0.8 } })
    rattle(v, { count: 6, over: 0.3, freq: 2000, gain: 0.12, delay: 0.25 })
  }),

  /** Three strikes: the die picked up and shaken in a cup. */
  diceShake: oneShot((v) => {
    rattle(v, { count: 22, over: 1.2, freq: 2400, gain: 0.6, q: 3 })
  }, { variants: 2 }),

  /** The die thrown: a whoosh. */
  diceThrow: oneShot((v) => {
    noise(v, { duration: 0.35, attack: 0.1, gain: 0.4, filter: { type: 'bandpass', freq: 800, to: 2600, q: 1 } })
  }),

  /** The die landing on wood: a few bounces. */
  diceLand: oneShot((v) => {
    for (const [delay, gain] of [[0, 0.4], [0.13, 0.22], [0.22, 0.12]] as const) {
      tone(v, { freq: 260, to: 120, delay, duration: 0.08, gain, type: 'sine' })
      noise(v, { delay, duration: 0.03, gain: gain * 0.6, filter: { type: 'bandpass', freq: 1600, q: 3 } })
    }
  }),

  /** A heart: relief, two notes up. */
  safe: oneShot((v) => {
    arpeggio(v, [NOTE.C5, NOTE.G5], 0.1, { duration: 0.3, gain: 0.22, type: 'triangle' })
  }),

  /** A skull: a doom gong. */
  skull: oneShot((v) => {
    strike(v, 65, { duration: 2.2, gain: 0.3, ratios: [1, 1.48, 2.02, 2.74, 3.76] })
    tone(v, { freq: 196, to: 98, duration: 0.8, gain: 0.15, type: 'sawtooth', filter: { type: 'lowpass', freq: 600 } })
  }),

  /** The board under strain, at two strikes: a wooden creak. */
  creak: oneShot((v) => {
    tone(v, { freq: 180, to: 140, duration: 0.6, gain: 0.9, type: 'sawtooth', filter: { type: 'bandpass', freq: 700, q: 3 }, vibrato: { rate: 23, depth: 0.08 } })
  }),

  /** The block crumbling: wood cracking and splintering. */
  crack: oneShot((v) => {
    noise(v, { duration: 0.08, gain: 0.45, filter: { type: 'highpass', freq: 1200 } })
    rattle(v, { count: 10, over: 0.5, freq: 900, gain: 0.25, delay: 0.05, q: 2 })
    tone(v, { freq: 90, to: 45, duration: 0.5, gain: 0.35, type: 'sine' })
  }, { variants: 2 }),

  /** Landing in the sea. */
  splash: oneShot((v) => {
    noise(v, { duration: 0.9, attack: 0.01, gain: 0.4, filter: { type: 'lowpass', freq: 4000, to: 300 } })
    tone(v, { freq: 120, to: 50, duration: 0.3, gain: 0.3, type: 'sine' })
    for (let index = 0; index < 5; index++) {
      tone(v, { freq: 600 + Math.random() * 900, to: 1400 + Math.random() * 800, delay: 0.25 + index * 0.08 + Math.random() * 0.05, duration: 0.06, gain: 0.05, type: 'sine' })
    }
  }, { variants: 2 }),

  /** The paragraph's own clock in its last seconds: a tick. */
  timerTick: oneShot((v) => {
    tone(v, { freq: 1700, duration: 0.03, gain: 0.12, type: 'square', filter: { type: 'lowpass', freq: 4000 } })
  }),

  /** Every paragraph typed / the race won: a fanfare. */
  win: oneShot((v) => {
    arpeggio(v, [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.09, { duration: 0.2, gain: 0.25, type: 'square', filter: { type: 'lowpass', freq: 3500 } })
    chord(v, [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], { delay: 0.4, duration: 1.0, gain: 0.3, type: 'sawtooth', filter: { type: 'lowpass', freq: 2400 } })
  }),
}
