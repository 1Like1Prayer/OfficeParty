import { arpeggio, noise, NOTE, rattle, strike, tone } from '../synth.ts'
import { oneShot, type Recipes } from '../types.ts'

/** Hex Drop: glassy tiles, warnings, drops, jumps, landings, and the long fall out. */

export const hexDropRecipes: Recipes = {
  /** The tile underfoot is about to go: a rattle. */
  tileWarning: oneShot((v) => {
    rattle(v, { count: 10, over: 0.9, freq: 3200, gain: 0.45, q: 3 })
  }),

  /** A tile dropping away: a crumble. Played for every tile, so it is gated. */
  tileDrop: oneShot((v) => {
    noise(v, { duration: 0.35, gain: 0.2, filter: { type: 'lowpass', freq: 2400, to: 400 } })
    strike(v, 1900, { duration: 0.2, gain: 0.06, ratios: [1, 1.5, 2.3] })
  }, { variants: 3 }),

  /** Jump: a springy boing. */
  jump: oneShot((v) => {
    tone(v, { freq: 220, to: 640, duration: 0.2, gain: 0.25, type: 'sine', vibrato: { rate: 26, depth: 0.05 } })
  }),

  /** Falling through a gap: a falling whistle. */
  falling: oneShot((v) => {
    tone(v, { freq: 1500, to: 500, duration: 0.7, gain: 0.12, type: 'sine' })
  }),

  /** Out through the bottom floor: a long falling scream of a whistle, fading away. */
  out: oneShot((v) => {
    tone(v, { freq: 1800, to: 120, duration: 2.0, gain: 0.25, type: 'sine', vibrato: { rate: 5, depth: 0.02 } })
    noise(v, { duration: 1.8, attack: 0.4, gain: 0.12, filter: { type: 'bandpass', freq: 600, to: 200, q: 1 } })
  }),

  /** Someone else falling out. */
  rivalOut: oneShot((v) => {
    tone(v, { freq: 1200, to: 200, duration: 0.8, gain: 0.08, type: 'sine' })
  }),

  /** Last one standing. */
  win: oneShot((v) => {
    arpeggio(v, [NOTE.E5, NOTE.G5, NOTE.B5, NOTE.E6], 0.08, { duration: 0.3, gain: 0.22, type: 'triangle' })
    strike(v, NOTE.E6, { delay: 0.32, duration: 1.2, gain: 0.12, ratios: [1, 2, 3] })
  }),

  tileTouch: oneShot((v) => {
    strike(v, 2300, { duration: 0.25, gain: 0.1, ratios: [1, 1.5, 2.7] })
  }, { variants: 2 }),

  landSoft: oneShot((v) => {
    noise(v, { duration: 0.05, gain: 0.15, filter: { type: 'lowpass', freq: 900 } })
    tone(v, { freq: 150, to: 80, duration: 0.08, gain: 0.2, type: 'sine' })
  }),

  landHard: oneShot((v) => {
    noise(v, { duration: 0.12, gain: 0.3, filter: { type: 'lowpass', freq: 1200 } })
    tone(v, { freq: 120, to: 50, duration: 0.2, gain: 0.4, type: 'sine' })
    strike(v, 1500, { duration: 0.25, gain: 0.05, ratios: [1, 1.5] })
  }),
}
