/** Where a recipe is rendered, and how: the voice every synth helper is handed. */
export interface Voice {
  ctx: BaseAudioContext
  /** The node the sound connects to. */
  out: AudioNode
  /** Context time the sound starts at. */
  at: number
  /** Loudness multiplier, 0–1+. */
  volume: number
  /** Frequency multiplier (1 = as written). */
  pitch: number
  /** White noise, two seconds of it, shared by every sound. */
  noise: AudioBuffer
}

/** Builds a continuous sound's sources into `out`. Returns the params a pitch change would steer, and how to stop it. */
export type LoopBuilder = (ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer) => {
  pitched: { param: AudioParam; base: number }[]
  stop: () => void
}

/**
 * The building blocks every sound's recipe is made from: a pitched tone, a burst of
 * filtered noise, and a few shapes built on those (chords, arpeggios, a
 * metallic strike, a run of rattles). Each takes the `Voice` the engine hands
 * an effect and schedules itself on the context's clock, so nothing here
 * waits on a timer.
 *
 * Times are in seconds, frequencies in Hz before the voice's pitch is applied,
 * and `gain` is the peak level before the voice's volume.
 */

const FLOOR = 0.0001

export type Wave = OscillatorType

export interface FilterSpec {
  type: BiquadFilterType
  freq: number
  /** Swept to over the sound's length. */
  to?: number
  q?: number
}

export interface ToneSpec {
  freq: number
  /** Glides here over `glide` seconds (default: the whole duration). */
  to?: number
  glide?: number
  type?: Wave
  /** Seconds from the voice's start. */
  delay?: number
  attack?: number
  /** Total length, attack included. */
  duration: number
  gain?: number
  /** Cents. */
  detune?: number
  filter?: FilterSpec
  /** Wobble the pitch: rate in Hz, depth as a fraction of the frequency. */
  vibrato?: { rate: number; depth: number }
  /** Stereo position, -1 left to 1 right. */
  pan?: number
}

export interface NoiseSpec {
  delay?: number
  attack?: number
  duration: number
  gain?: number
  filter?: FilterSpec
  pan?: number
  /** Playback rate of the noise buffer: below 1 darkens it. */
  rate?: number
}

/** A rise to `peak` over `attack`, then an exponential fall to silence by `end`. */
function envelope(param: AudioParam, start: number, attack: number, end: number, peak: number): void {
  const top = Math.max(FLOOR * 2, peak)
  param.setValueAtTime(FLOOR, start)
  param.exponentialRampToValueAtTime(top, start + Math.max(0.001, attack))
  param.exponentialRampToValueAtTime(FLOOR, Math.max(start + attack + 0.005, end))
}

function makeFilter(v: Voice, spec: FilterSpec, start: number, end: number): BiquadFilterNode {
  const filter = v.ctx.createBiquadFilter()
  filter.type = spec.type
  filter.Q.value = spec.q ?? 1
  filter.frequency.setValueAtTime(spec.freq, start)
  if (spec.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), end)
  return filter
}

function panned(v: Voice, node: AudioNode, pan: number | undefined): AudioNode {
  if (pan === undefined || pan === 0 || typeof v.ctx.createStereoPanner !== 'function') return node
  const panner = v.ctx.createStereoPanner()
  panner.pan.value = Math.max(-1, Math.min(1, pan))
  node.connect(panner)
  return panner
}

/** One oscillator through an envelope (and optionally a filter). */
export function tone(v: Voice, spec: ToneSpec): void {
  const start = v.at + (spec.delay ?? 0)
  const end = start + spec.duration
  const osc = v.ctx.createOscillator()
  osc.type = spec.type ?? 'sine'
  if (spec.detune !== undefined) osc.detune.value = spec.detune
  const freq = Math.max(20, spec.freq * v.pitch)
  osc.frequency.setValueAtTime(freq, start)
  if (spec.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to * v.pitch), start + (spec.glide ?? spec.duration))
  }

  if (spec.vibrato !== undefined) {
    const lfo = v.ctx.createOscillator()
    const depth = v.ctx.createGain()
    lfo.frequency.value = spec.vibrato.rate
    depth.gain.value = freq * spec.vibrato.depth
    lfo.connect(depth).connect(osc.frequency)
    lfo.start(start)
    lfo.stop(end + 0.05)
  }

  const amp = v.ctx.createGain()
  envelope(amp.gain, start, spec.attack ?? 0.004, end, (spec.gain ?? 0.4) * v.volume)
  let node: AudioNode = osc
  if (spec.filter !== undefined) {
    const filter = makeFilter(v, spec.filter, start, end)
    osc.connect(filter)
    node = filter
  }
  node.connect(amp)
  panned(v, amp, spec.pan).connect(v.out)
  osc.start(start)
  osc.stop(end + 0.05)
}

/** A burst of white noise through an envelope and a filter: hits, whooshes, crackle, splashes. */
export function noise(v: Voice, spec: NoiseSpec): void {
  const start = v.at + (spec.delay ?? 0)
  const end = start + spec.duration
  const source = v.ctx.createBufferSource()
  source.buffer = v.noise
  source.playbackRate.value = (spec.rate ?? 1) * Math.sqrt(v.pitch)
  const amp = v.ctx.createGain()
  envelope(amp.gain, start, spec.attack ?? 0.002, end, (spec.gain ?? 0.4) * v.volume)
  let node: AudioNode = source
  if (spec.filter !== undefined) {
    const filter = makeFilter(v, spec.filter, start, end)
    source.connect(filter)
    node = filter
  }
  node.connect(amp)
  panned(v, amp, spec.pan).connect(v.out)
  // A different stretch of the noise every time.
  source.start(start, Math.random() * 1.5)
  source.stop(end + 0.05)
}

/** Several tones at once. */
export function chord(v: Voice, freqs: readonly number[], spec: Omit<ToneSpec, 'freq'>): void {
  const each = (spec.gain ?? 0.4) / Math.sqrt(freqs.length)
  for (const freq of freqs) tone(v, { ...spec, freq, gain: each })
}

/** Tones one after another, `step` seconds apart. */
export function arpeggio(v: Voice, freqs: readonly number[], step: number, spec: Omit<ToneSpec, 'freq'>): void {
  freqs.forEach((freq, index) => { tone(v, { ...spec, freq, delay: (spec.delay ?? 0) + index * step }) })
}

/**
 * A struck piece of metal or glass: a handful of inharmonic partials, the
 * higher ones dying first. `ratios` shapes the material (bells, clanks, tinks).
 */
export function strike(
  v: Voice,
  freq: number,
  spec: { duration: number; gain?: number; delay?: number; ratios?: readonly number[]; type?: Wave },
): void {
  const ratios = spec.ratios ?? [1, 2.76, 5.4, 8.93]
  ratios.forEach((ratio, index) => {
    tone(v, {
      freq: freq * ratio,
      type: spec.type ?? 'sine',
      delay: spec.delay,
      attack: 0.002,
      duration: spec.duration / (1 + index * 0.7),
      gain: (spec.gain ?? 0.35) / (1 + index * 0.9),
    })
  })
}

/** A run of short clicks at uneven spacing: dice in a cup, a rattling tile, a geiger counter. */
export function rattle(
  v: Voice,
  spec: { count: number; over: number; freq: number; gain?: number; delay?: number; q?: number },
): void {
  for (let index = 0; index < spec.count; index++) {
    const at = (spec.delay ?? 0) + (index / spec.count) * spec.over + Math.random() * (spec.over / spec.count) * 0.6
    noise(v, {
      delay: at,
      duration: 0.025 + Math.random() * 0.02,
      gain: (spec.gain ?? 0.3) * (0.6 + Math.random() * 0.4),
      filter: { type: 'bandpass', freq: spec.freq * (0.8 + Math.random() * 0.4), q: spec.q ?? 4 },
    })
  }
}

/* ---------------- loops ---------------- */

/** A droning tone (or several), optionally filtered and wobbled: hums, engines, beams. */
export function droneLoop(spec: {
  freqs: readonly number[]
  type?: Wave
  filter?: { type: BiquadFilterType; freq: number; q?: number }
  /** Slow wobble of the level: rate in Hz, depth 0–1. */
  pulse?: { rate: number; depth: number }
  gain?: number
}): LoopBuilder {
  return (ctx, out) => {
    const mix = ctx.createGain()
    mix.gain.value = (spec.gain ?? 0.3) / Math.sqrt(spec.freqs.length)
    const stops: (() => void)[] = []
    let head: AudioNode = mix
    if (spec.filter !== undefined) {
      const filter = ctx.createBiquadFilter()
      filter.type = spec.filter.type
      filter.frequency.value = spec.filter.freq
      filter.Q.value = spec.filter.q ?? 1
      mix.connect(filter)
      head = filter
    }
    if (spec.pulse !== undefined) {
      const wobble = ctx.createGain()
      wobble.gain.value = 1 - spec.pulse.depth / 2
      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.frequency.value = spec.pulse.rate
      depth.gain.value = spec.pulse.depth / 2
      lfo.connect(depth).connect(wobble.gain)
      lfo.start()
      stops.push(() => { lfo.stop() })
      head.connect(wobble)
      head = wobble
    }
    head.connect(out)

    const pitched = spec.freqs.map((freq, index) => {
      const osc = ctx.createOscillator()
      osc.type = spec.type ?? 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = (index % 2 === 0 ? 1 : -1) * 6 * index
      osc.connect(mix)
      osc.start()
      stops.push(() => { osc.stop() })
      return { param: osc.frequency, base: freq }
    })
    return { pitched, stop: () => { stops.forEach((stop) => { stop() }) } }
  }
}

/** Filtered noise that never ends, optionally swelling: sea, wind, rumbling belts. */
export function noiseLoop(spec: {
  filter: { type: BiquadFilterType; freq: number; q?: number }
  /** Swell the filter and level slowly: rate in Hz, depth 0–1. */
  swell?: { rate: number; depth: number }
  gain?: number
  rate?: number
}): LoopBuilder {
  return (ctx, out, buffer) => {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.playbackRate.value = spec.rate ?? 1
    const filter = ctx.createBiquadFilter()
    filter.type = spec.filter.type
    filter.frequency.value = spec.filter.freq
    filter.Q.value = spec.filter.q ?? 0.7
    const amp = ctx.createGain()
    amp.gain.value = spec.gain ?? 0.3
    source.connect(filter).connect(amp).connect(out)
    const stops: (() => void)[] = [() => { source.stop() }]

    if (spec.swell !== undefined) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = spec.swell.rate
      const toFilter = ctx.createGain()
      toFilter.gain.value = spec.filter.freq * spec.swell.depth
      const toLevel = ctx.createGain()
      toLevel.gain.value = (spec.gain ?? 0.3) * spec.swell.depth * 0.6
      lfo.connect(toFilter).connect(filter.frequency)
      lfo.connect(toLevel).connect(amp.gain)
      lfo.start()
      stops.push(() => { lfo.stop() })
    }
    source.start()
    return { pitched: [{ param: filter.frequency, base: spec.filter.freq }], stop: () => { stops.forEach((stop) => { stop() }) } }
  }
}

/** Several loops as one: a drone with a noise bed, say. */
export function layeredLoop(...builders: LoopBuilder[]): LoopBuilder {
  return (ctx, out, buffer) => {
    const parts = builders.map((build) => build(ctx, out, buffer))
    return {
      pitched: parts.flatMap(({ pitched }) => pitched),
      stop: () => { parts.forEach(({ stop }) => { stop() }) },
    }
  }
}

/* ---------------- notes ---------------- */

/** Equal-tempered note frequencies, for writing jingles by name. */
export const NOTE = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, C7: 2093.0,
} as const
