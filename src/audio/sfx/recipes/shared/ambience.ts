import { noiseLoop, type Voice } from '../synth.ts'
import { loop, LOW_RATE, oneShot, type Recipes } from '../types.ts'

/** The world around a game: the sea, the wind, gulls. */

/**
 * One gull cry: the pitch swoops up, then falls away — "kee-aaw" — with a
 * nasal, slightly rasping voice. `base` is the cry's pitch in Hz, `pan` where
 * it is heard from (-1 left to 1 right).
 */
function gullCry(v: Voice, delay: number, base: number, length: number, peak: number, pan: number): void {
  const { ctx } = v
  const start = v.at + delay
  const end = start + length
  const pitch = base * v.pitch

  const voice = ctx.createOscillator()
  voice.type = 'sawtooth'
  voice.frequency.setValueAtTime(pitch * 0.72, start)
  voice.frequency.linearRampToValueAtTime(pitch * 1.18, start + length * 0.14)
  voice.frequency.linearRampToValueAtTime(pitch, start + length * 0.3)
  voice.frequency.exponentialRampToValueAtTime(pitch * 0.58, end)

  // The rasp: a fast wobble in the pitch.
  const rasp = ctx.createOscillator()
  const raspDepth = ctx.createGain()
  rasp.frequency.value = 26 + Math.random() * 10
  raspDepth.gain.value = pitch * 0.035
  rasp.connect(raspDepth).connect(voice.frequency)

  // The nasal colour: a narrow band, with the fizz above it taken off (gulls are far away).
  const nasal = ctx.createBiquadFilter()
  nasal.type = 'bandpass'
  nasal.frequency.value = pitch * 1.6
  nasal.Q.value = 2.2
  const distance = ctx.createBiquadFilter()
  distance.type = 'lowpass'
  distance.frequency.value = 3800

  const amp = ctx.createGain()
  const level = Math.max(0.0002, peak * v.volume)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(level, start + 0.03)
  amp.gain.setValueAtTime(level, start + length * 0.55)
  amp.gain.exponentialRampToValueAtTime(0.0001, end)

  let tail: AudioNode = amp
  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    amp.connect(panner)
    tail = panner
  }
  voice.connect(nasal).connect(distance).connect(amp)
  tail.connect(v.out)

  voice.start(start)
  rasp.start(start)
  voice.stop(end + 0.05)
  rasp.stop(end + 0.05)
}

export const ambienceRecipes: Recipes = {
  /**
  * A gull, somewhere off to one side: two to four cries, each a little lower
  * and quieter than the last, now and then answered by a second, further one.
  */
  seagulls: oneShot((v) => {
    const pan = (Math.random() * 2 - 1) * 0.8
    const base = 1250 + Math.random() * 450
    const cries = 2 + Math.floor(Math.random() * 3)
    let at = 0
    for (let cry = 0; cry < cries; cry++) {
      const length = 0.32 + Math.random() * 0.12
      gullCry(v, at, base * (1 - cry * 0.05), length, 0.3 * (1 - cry * 0.15), pan)
      at += length + 0.06 + Math.random() * 0.1
    }
    // Sometimes another answers from the other side, further off.
    if (Math.random() < 0.4) {
      const answerAt = at + 0.4 + Math.random() * 0.6
      gullCry(v, answerAt, base * 0.9, 0.38, 0.15, -pan * 0.9)
      gullCry(v, answerAt + 0.48, base * 0.86, 0.34, 0.11, -pan * 0.9)
    }
  }, { variants: 6, stereo: true }),

  /** Waves, for any game out over the sea. A slow swell, looped. */
  sea: loop(noiseLoop({ filter: { type: 'lowpass', freq: 500 }, swell: { rate: 0.12, depth: 0.7 }, gain: 0.35, rate: 0.6 }), 10, LOW_RATE),

  /** Wind, gusting slowly. */
  wind: loop(noiseLoop({ filter: { type: 'bandpass', freq: 500, q: 0.8 }, swell: { rate: 0.1, depth: 0.7 }, gain: 0.12, rate: 0.5 }), 10, LOW_RATE),
}
