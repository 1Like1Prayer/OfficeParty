import { arpeggio, noise, NOTE, tone } from '../synth.ts'
import { oneShot, type Recipes } from '../types.ts'

/** Log Dodge: logs rolling in, jumping and ducking, getting hit, and being thrown off. */

export const logDodgeRecipes: Recipes = {
  /** Jump: a quick upward hop. */
  jump: oneShot((v) => {
    tone(v, { freq: 260, to: 720, duration: 0.14, gain: 0.25, type: 'square', filter: { type: 'lowpass', freq: 2200 } })
    noise(v, { duration: 0.05, gain: 0.08, filter: { type: 'bandpass', freq: 900, q: 2 } })
  }),

  /** Duck: a downward swish. */
  duck: oneShot((v) => {
    noise(v, { duration: 0.18, attack: 0.03, gain: 0.2, filter: { type: 'bandpass', freq: 2400, to: 600, q: 1.5 } })
    tone(v, { freq: 500, to: 220, duration: 0.12, gain: 0.12, type: 'triangle' })
  }),

  /** Hit by a log: a wooden bonk and an oof. */
  hit: oneShot((v) => {
    tone(v, { freq: 240, to: 110, duration: 0.18, gain: 0.45, type: 'sine' })
    noise(v, { duration: 0.06, gain: 0.3, filter: { type: 'bandpass', freq: 900, q: 1.5 } })
    tone(v, { freq: 330, to: 200, delay: 0.06, duration: 0.2, gain: 0.12, type: 'sawtooth', filter: { type: 'lowpass', freq: 900 } })
  }),

  /** A life gone, on the HUD: a falling pair of blips. */
  lifeLost: oneShot((v) => {
    tone(v, { freq: 880, duration: 0.08, gain: 0.14, type: 'square', filter: { type: 'lowpass', freq: 3000 } })
    tone(v, { freq: 587, delay: 0.09, duration: 0.14, gain: 0.14, type: 'square', filter: { type: 'lowpass', freq: 3000 } })
  }),

  /** Thrown off the back: a falling whistle and a splash. */
  knockedOut: oneShot((v) => {
    tone(v, { freq: 1400, to: 300, duration: 0.9, gain: 0.18, type: 'sine' })
    noise(v, { delay: 0.85, duration: 0.8, gain: 0.35, filter: { type: 'lowpass', freq: 3500, to: 300 } })
    tone(v, { freq: 110, to: 50, delay: 0.85, duration: 0.3, gain: 0.3, type: 'sine' })
  }),

  /** Last one standing. */
  win: oneShot((v) => {
    arpeggio(v, [NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.07, { duration: 0.22, gain: 0.25, type: 'square', filter: { type: 'lowpass', freq: 3500 } })
  }),

  logRoll: oneShot((v) => {
    noise(v, { duration: 0.9, attack: 0.6, gain: 0.22, filter: { type: 'lowpass', freq: 180, to: 520 }, rate: 0.5 })
    tone(v, { freq: 48, to: 62, duration: 0.9, attack: 0.6, gain: 0.25, type: 'triangle' })
  }, { variants: 2 }),
}
