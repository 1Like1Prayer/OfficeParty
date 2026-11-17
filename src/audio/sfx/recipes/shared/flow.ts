import { arpeggio, chord, noise, NOTE, rattle, strike, tone } from '../synth.ts'
import { oneShot, type Recipes } from '../types.ts'

/** The sounds every game shares: the run-up to a round, the count-in, screens changing, results, the champion. */

export const flowRecipes: Recipes = {
  /** A whole screen swiping over to the next: an airy whoosh. */
  whoosh: oneShot((v) => {
    noise(v, { duration: 0.42, attack: 0.16, gain: 0.22, filter: { type: 'bandpass', freq: 500, to: 3200, q: 1.2 } })
  }),

  /** The next game announced: a game-show "ta-da". */
  reveal: oneShot((v) => {
    arpeggio(v, [NOTE.C5, NOTE.E5, NOTE.G5], 0.07, { duration: 0.14, gain: 0.22, type: 'square', filter: { type: 'lowpass', freq: 3500 } })
    chord(v, [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], { delay: 0.24, attack: 0.01, duration: 0.7, gain: 0.32, type: 'sawtooth', filter: { type: 'lowpass', freq: 2600 } })
    noise(v, { delay: 0.24, duration: 0.4, gain: 0.08, filter: { type: 'highpass', freq: 6000 } })
  }),

  /** A tiebreak: two ominous low hits. */
  tiebreak: oneShot((v) => {
    for (const [delay, freq] of [[0, NOTE.D3], [0.32, NOTE.C3 * 1.06]] as const) {
      tone(v, { freq, delay, duration: 0.5, gain: 0.4, type: 'sawtooth', filter: { type: 'lowpass', freq: 600 } })
      tone(v, { freq: freq / 2, delay, duration: 0.6, gain: 0.35, type: 'sine' })
    }
  }),

  /** START!: a bright horn chord with a burst behind it. */
  go: oneShot((v) => {
    chord(v, [NOTE.A5, NOTE.C6 * 1.06, NOTE.E6], { attack: 0.005, duration: 0.55, gain: 0.38, type: 'square', filter: { type: 'lowpass', freq: 5000, to: 1800 } })
    tone(v, { freq: 220, to: 880, duration: 0.18, gain: 0.2, type: 'sawtooth', filter: { type: 'lowpass', freq: 3000 } })
    noise(v, { duration: 0.25, gain: 0.12, filter: { type: 'highpass', freq: 4000 } })
  }),

  /** The TV intro's camera gliding in: a long swoosh. */
  swoosh: oneShot((v) => {
    noise(v, { duration: 1.1, attack: 0.5, gain: 0.16, filter: { type: 'bandpass', freq: 300, to: 1800, q: 1.4 } })
  }),

  /** A screen switching on: a crackle and a hum. */
  tvOn: oneShot((v) => {
    noise(v, { duration: 0.08, gain: 0.2, filter: { type: 'highpass', freq: 2500 } })
    tone(v, { freq: 60, duration: 0.25, gain: 0.18, type: 'sawtooth', filter: { type: 'lowpass', freq: 400 } })
    tone(v, { freq: 15700 / 4, delay: 0.03, duration: 0.2, gain: 0.03, type: 'sine' })
  }),

  /** Results coming in: a short snare roll that swells. */
  drumroll: oneShot((v) => {
    rattle(v, { count: 18, over: 0.7, freq: 1800, gain: 0.22, q: 0.8 })
  }),

  /** A round's results on screen: a cheerful sting. */
  resultsSting: oneShot((v) => {
    arpeggio(v, [NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5], 0.08, { duration: 0.2, gain: 0.24, type: 'triangle' })
    chord(v, [NOTE.C5, NOTE.E5, NOTE.G5], { delay: 0.32, duration: 0.6, gain: 0.22, type: 'triangle' })
  }),

  /** The player's own row came first. */
  youWon: oneShot((v) => {
    arpeggio(v, [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6], 0.06, { duration: 0.18, gain: 0.25, type: 'square', filter: { type: 'lowpass', freq: 4000 } })
    chord(v, [NOTE.C6, NOTE.E6, NOTE.G6], { delay: 0.3, duration: 0.8, gain: 0.25, type: 'triangle', vibrato: { rate: 6, depth: 0.01 } })
    noise(v, { delay: 0.3, duration: 0.6, gain: 0.06, filter: { type: 'highpass', freq: 7000 } })
  }),

  /** Someone else won, or it went badly: a sad trombone. */
  youLost: oneShot((v) => {
    const notes = [NOTE.G4, NOTE.F4 * 1.03, NOTE.E4 * 1.04, NOTE.D4 * 1.06]
    notes.forEach((freq, index) => {
      const isLast = index === notes.length - 1
      tone(v, {
        freq,
        delay: index * 0.28,
        duration: isLast ? 0.8 : 0.26,
        gain: 0.26,
        type: 'sawtooth',
        filter: { type: 'lowpass', freq: 1200 },
        vibrato: isLast ? { rate: 5, depth: 0.025 } : undefined,
      })
    })
  }),

  /** Points ticking onto the scoreboard: a coin. */
  scoreTick: oneShot((v) => {
    tone(v, { freq: NOTE.B5, duration: 0.06, gain: 0.14, type: 'square', filter: { type: 'lowpass', freq: 5000 } })
    tone(v, { freq: NOTE.E6, delay: 0.06, duration: 0.18, gain: 0.14, type: 'square', filter: { type: 'lowpass', freq: 5000 } })
  }),

  /** A player knocked out of a game, from anyone's game: a short falling blip. */
  eliminated: oneShot((v) => {
    tone(v, { freq: 700, to: 160, duration: 0.35, gain: 0.22, type: 'square', filter: { type: 'lowpass', freq: 2200 } })
  }),

  /** The champion of the night: a brassy fanfare, with cymbals. */
  fanfare: oneShot((v) => {
    const brass = { type: 'sawtooth' as const, filter: { type: 'lowpass' as const, freq: 2200 }, attack: 0.02 }
    const line: [number, number, number][] = [
      [NOTE.G4, 0, 0.14], [NOTE.G4, 0.16, 0.14], [NOTE.G4, 0.32, 0.14],
      [NOTE.C5, 0.48, 0.5], [NOTE.G4, 1.0, 0.18], [NOTE.C5, 1.2, 0.18], [NOTE.E5, 1.4, 1.1],
    ]
    for (const [freq, delay, duration] of line) {
      tone(v, { ...brass, freq, delay, duration, gain: 0.3 })
      tone(v, { ...brass, freq: freq * 1.5, delay, duration, gain: 0.12 })
    }
    chord(v, [NOTE.C4, NOTE.E4, NOTE.G4], { delay: 1.4, duration: 1.4, gain: 0.25, type: 'sawtooth', filter: { type: 'lowpass', freq: 1400 } })
    noise(v, { delay: 1.4, duration: 1.6, gain: 0.12, filter: { type: 'highpass', freq: 5000 } })
    strike(v, 2400, { delay: 1.4, duration: 1.2, gain: 0.08, ratios: [1, 1.48, 2.1, 2.9] })
  }),

  /** Confetti: a scatter of high sparkles. */
  confetti: oneShot((v) => {
    for (let index = 0; index < 14; index++) {
      tone(v, { freq: 2200 + Math.random() * 3000, delay: index * 0.045 + Math.random() * 0.03, duration: 0.12, gain: 0.06, type: 'sine' })
    }
  }, { variants: 2 }),

  startsInTick: oneShot((v) => {
    tone(v, { freq: 1050, duration: 0.07, gain: 0.35, type: 'sine' })
    noise(v, { duration: 0.03, gain: 0.12, filter: { type: 'bandpass', freq: 2600, q: 3 } })
  }),

  cueBeep: oneShot((v) => {
    tone(v, { freq: NOTE.A5 * 0.75, duration: 0.22, gain: 0.3, type: 'square', filter: { type: 'lowpass', freq: 3000 } })
  }),
}
