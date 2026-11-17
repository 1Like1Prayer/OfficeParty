import { arpeggio, noise, NOTE, tone } from '../synth.ts'
import { oneShot, type Recipes } from '../types.ts'

/** Menu and lobby sounds: buttons, the room filling up, readying, copying the code, typing, things going wrong. */

export const uiRecipes: Recipes = {
  /** Any chunky button: a short rounded pop. */
  click: oneShot((v) => {
    tone(v, { freq: 900, to: 420, duration: 0.07, gain: 0.32, type: 'sine' })
    noise(v, { duration: 0.02, gain: 0.08, filter: { type: 'highpass', freq: 3000 } })
  }),

  /** The mouse moving onto a button: a faint, airy tick. */
  hover: oneShot((v) => {
    tone(v, { freq: 2100, to: 2600, duration: 0.03, gain: 0.05, type: 'sine' })
  }),

  /** A small toggle (a game chip, "select all"): a tick, up for on and down for off. */
  toggle: oneShot((v) => {
    tone(v, { freq: 1400, duration: 0.045, gain: 0.18, type: 'triangle' })
  }),

  /** A keystroke in a code box or the name field. */
  key: oneShot((v) => {
    noise(v, { duration: 0.025, gain: 0.12, filter: { type: 'bandpass', freq: 3500, q: 2 } })
    tone(v, { freq: 1800, duration: 0.02, gain: 0.05, type: 'square' })
  }, { variants: 3 }),

  /** Someone joined the room: a bubbly upward pop. */
  playerJoin: oneShot((v) => {
    tone(v, { freq: 320, to: 980, duration: 0.11, gain: 0.35, type: 'sine', glide: 0.08 })
    tone(v, { freq: 1300, delay: 0.07, duration: 0.09, gain: 0.12, type: 'triangle' })
  }),

  /** Someone left or was removed: the same pop, falling. */
  playerLeave: oneShot((v) => {
    tone(v, { freq: 760, to: 220, duration: 0.16, gain: 0.3, type: 'sine' })
  }),

  /** "I'm ready": a bright two-note ding. */
  ready: oneShot((v) => {
    tone(v, { freq: NOTE.A5, duration: 0.18, gain: 0.25, type: 'triangle' })
    tone(v, { freq: NOTE.E6, delay: 0.07, duration: 0.35, gain: 0.25, type: 'triangle' })
  }),

  /** Ready taken back: a softer pair, falling. */
  unready: oneShot((v) => {
    tone(v, { freq: NOTE.E5, duration: 0.1, gain: 0.18, type: 'triangle' })
    tone(v, { freq: NOTE.A4, delay: 0.06, duration: 0.16, gain: 0.16, type: 'triangle' })
  }),

  /** The room code went to the clipboard: two quick blips. */
  copy: oneShot((v) => {
    tone(v, { freq: 1500, duration: 0.05, gain: 0.14, type: 'square', filter: { type: 'lowpass', freq: 4000 } })
    tone(v, { freq: 2000, delay: 0.06, duration: 0.07, gain: 0.14, type: 'square', filter: { type: 'lowpass', freq: 4000 } })
  }),

  /** A refusal (a wrong code, a full room): a low double buzz. */
  error: oneShot((v) => {
    for (const delay of [0, 0.14]) {
      tone(v, { freq: 150, delay, duration: 0.12, gain: 0.25, type: 'sawtooth', filter: { type: 'lowpass', freq: 900 } })
      tone(v, { freq: 156, delay, duration: 0.12, gain: 0.2, type: 'square', filter: { type: 'lowpass', freq: 700 } })
    }
  }),

  /** Lost the connection: static, and a sagging tone. */
  disconnect: oneShot((v) => {
    noise(v, { duration: 0.35, gain: 0.18, filter: { type: 'bandpass', freq: 2500, q: 0.8 } })
    tone(v, { freq: 600, to: 90, duration: 0.5, gain: 0.25, type: 'triangle' })
  }),

  /** Back online: a rising three-note chirp. */
  reconnect: oneShot((v) => {
    arpeggio(v, [NOTE.C5, NOTE.E5, NOTE.G5], 0.06, { duration: 0.12, gain: 0.2, type: 'triangle' })
  }),
}
