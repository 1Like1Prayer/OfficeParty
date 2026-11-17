import { arpeggio, noise, NOTE, tone } from '../synth.ts'
import { oneShot, type Recipes } from '../types.ts'

/** Minefield: footsteps, sonar, mines going off, and the finish line. */

export const minefieldRecipes: Recipes = {
  /** A footstep on sand. */
  footstep: oneShot((v) => {
    noise(v, { duration: 0.06, gain: 0.12, filter: { type: 'lowpass', freq: 900 } })
    noise(v, { duration: 0.03, gain: 0.05, filter: { type: 'highpass', freq: 3000 } })
  }, { variants: 4 }),

  /** A sonar pulse: a submarine ping and its echo. Played for anyone's scan, quieter the further off. */
  sonar: oneShot((v) => {
    tone(v, { freq: 1350, duration: 1.2, attack: 0.004, gain: 0.3, type: 'sine' })
    tone(v, { freq: 1350, delay: 0.35, duration: 0.9, gain: 0.1, type: 'sine' })
    tone(v, { freq: 1350, delay: 0.7, duration: 0.6, gain: 0.04, type: 'sine' })
    tone(v, { freq: 2700, duration: 0.3, gain: 0.05, type: 'sine' })
  }),

  /** The sonar is charged again. */
  sonarReady: oneShot((v) => {
    tone(v, { freq: 1000, duration: 0.06, gain: 0.14, type: 'triangle' })
    tone(v, { freq: 1500, delay: 0.07, duration: 0.1, gain: 0.14, type: 'triangle' })
  }),

  /** A mine found by a scan, popping up out of the sand. */
  mineRevealed: oneShot((v) => {
    tone(v, { freq: 500, to: 1100, duration: 0.08, gain: 0.08, type: 'square', filter: { type: 'lowpass', freq: 2500 } })
  }),

  /** A mine going off: a boom with a long tail. Quieter the further off. */
  explosion: oneShot((v) => {
    tone(v, { freq: 90, to: 28, duration: 0.9, gain: 0.45, type: 'sine' })
    noise(v, { duration: 1.4, attack: 0.005, gain: 0.55, filter: { type: 'lowpass', freq: 2400, to: 150 } })
    noise(v, { duration: 0.12, gain: 0.35, filter: { type: 'highpass', freq: 1500 } })
  }, { variants: 2 }),

  /** Ringing ears after a blast right beside the player. */
  earRing: oneShot((v) => {
    tone(v, { freq: 3800, delay: 0.2, attack: 0.3, duration: 2.2, gain: 0.05, type: 'sine' })
  }),

  /** Blown up the second time: out of the race. */
  out: oneShot((v) => {
    tone(v, { freq: 520, to: 130, delay: 0.5, duration: 0.9, gain: 0.25, type: 'sawtooth', filter: { type: 'lowpass', freq: 1200 }, vibrato: { rate: 6, depth: 0.03 } })
  }),

  /** Across the finish line: a referee's whistle. */
  finish: oneShot((v) => {
    tone(v, { freq: 2600, duration: 0.6, attack: 0.01, gain: 0.25, type: 'sine', vibrato: { rate: 38, depth: 0.04 } })
    arpeggio(v, [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.08, { delay: 0.5, duration: 0.25, gain: 0.22, type: 'triangle' })
  }),
}
