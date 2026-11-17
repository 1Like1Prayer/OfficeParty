import { backgroundMusic } from '../../backgroundMusic.ts'
import { LIBRARY, LOAD_ORDER } from './library.ts'

/**
 * The sound-effects engine: plays the game's sound files (see library.ts)
 * through one Web Audio context, split into two channels with their own volume
 * and mute (kept apart from the music's, and remembered in this browser):
 *
 * - `effects`: everything that answers the game — presses, hits, the
 *   count-in, results, and the loops that carry information (the black hole's
 *   hunger, the beams' clash).
 * - `ambience`: the world around a game — the sea, wind, gulls, the
 *   escalator's machinery. Turning it down loses nothing a player needs to hear.
 *
 * Every file is fetched and decoded once, in the background, as the page
 * loads (the shared sounds first). Each play can still be nudged: in pitch (by
 * playback rate), in loudness, and between takes.
 *
 * Browsers keep audio suspended until the visitor touches the page; sounds
 * asked for before then, or before their file has arrived, are dropped rather
 * than queued, so nothing bursts out all at once later.
 */

export type Channel = 'effects' | 'ambience'

export interface ChannelSettings {
  /** 0–1. */
  volume: number
  isMuted: boolean
}

export type SfxSettings = Record<Channel, ChannelSettings>

export interface PlayOptions {
  /** Which channel it plays on; `effects` unless said otherwise. */
  channel?: Channel
  /** Loudness multiplier, default 1. */
  volume?: number
  /** Pitch (and speed) multiplier, default 1. */
  pitch?: number
  /** Random pitch spread either side, as a fraction (0.05 = ±5%). Stops repeated sounds sounding robotic. */
  vary?: number
  /** Seconds from now. */
  delay?: number
  /**
   * The same `gate` key will not play again within `minGapMs`. For sounds that
   * can be asked for many times at once (other players' events, tiles dropping).
   */
  gate?: string
  minGapMs?: number
  /** Lower the music under this sound: depth 0–1 and how long to hold it, in ms. */
  duck?: { depth: number; holdMs: number }
}

/** A looping sound file and its channel (see `loopSound`). */
export interface LoopSound {
  id: string
  channel: Channel
}

/** A sound that runs until it is stopped, with its level and pitch steered as it plays. */
export interface LoopHandle {
  /** 0–1; ramps there smoothly. */
  setLevel: (level: number) => void
  /** Pitch (and speed) multiplier; ramps there smoothly. */
  setPitch: (pitch: number) => void
  stop: () => void
}

const STORAGE_KEY = 'office-party.sfx'
const DEFAULTS: SfxSettings = {
  effects: { volume: 0.8, isMuted: false },
  ambience: { volume: 0.7, isMuted: false },
}
const CHANNELS: readonly Channel[] = ['effects', 'ambience']
const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const
/** Quieter than this at the start of a file counts as padding, and is skipped. */
const LEAD_IN_SILENCE = 0.002
/**
 * The most that is ever skipped. An MP3 encoder's padding is about 35 ms at
 * most; anything longer is a pause the sound means to have (a groan that
 * follows a blast, sparkles after a cast), and is kept.
 */
const MAX_LEAD_IN_SECONDS = 0.04

/**
 * Where a take really starts. An MP3 encoder pads the front with a few
 * milliseconds of silence, which most browsers strip but some may not;
 * starting past it keeps a click as immediate as the press that made it.
 */
function leadIn(buffer: AudioBuffer): number {
  let first = buffer.length
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel)
    for (let index = 0; index < Math.min(first, samples.length); index++) {
      if (Math.abs(samples[index]!) > LEAD_IN_SILENCE) { first = index; break }
    }
  }
  // A whisker before it, so the sound's own attack is kept whole.
  if (first >= buffer.length) return 0
  return Math.min(MAX_LEAD_IN_SECONDS, Math.max(0, first - Math.round(buffer.sampleRate * 0.001)) / buffer.sampleRate)
}

/** A decoded take of a sound, and where to start playing it from. */
interface Take {
  buffer: AudioBuffer
  /** Seconds of padding at the front to skip. */
  offset: number
}
/** Files fetched at once while loading. */
const LOAD_CONCURRENCY = 6

function readChannel(saved: unknown, fallback: ChannelSettings): ChannelSettings {
  if (typeof saved !== 'object' || saved === null) return fallback
  const { volume, isMuted } = saved as Partial<ChannelSettings>
  return {
    volume: typeof volume === 'number' ? Math.min(1, Math.max(0, volume)) : fallback.volume,
    isMuted: isMuted === true,
  }
}

function load(): SfxSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULTS
    const saved = JSON.parse(raw) as Record<string, unknown>
    // Saved before there were channels: one volume, for what are now the effects.
    const effects = 'effects' in saved ? saved.effects : saved
    return {
      effects: readChannel(effects, DEFAULTS.effects),
      ambience: readChannel(saved.ambience, DEFAULTS.ambience),
    }
  } catch {
    return DEFAULTS
  }
}

class SfxEngine {
  private context: AudioContext | null = null
  private channels: Record<Channel, GainNode> | null = null
  /** Decoded takes, by sound id. */
  private readonly buffers = new Map<string, Take[]>()
  /** Called when a sound's takes have arrived: loops started before then are waiting on them. */
  private readonly waiting = new Map<string, (() => void)[]>()
  private readonly lastPlayed = new Map<string, number>()
  private readonly warned = new Set<string>()
  private readonly listeners = new Set<() => void>()
  private settings: SfxSettings = load()

  /** Creates the context (suspended until a gesture), starts loading every file, and listens for that gesture. Safe to call more than once. */
  start(): void {
    if (this.context !== null || typeof window === 'undefined') return
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass === undefined) return

    const context = new AudioContextClass({ latencyHint: 'interactive' })
    // A gentle limiter, so a pile-up of sounds never clips.
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.knee.value = 8
    limiter.ratio.value = 6
    limiter.attack.value = 0.003
    limiter.release.value = 0.15
    limiter.connect(context.destination)

    const channel = (name: Channel): GainNode => {
      const gain = context.createGain()
      gain.gain.value = this.effectiveVolume(name)
      gain.connect(limiter)
      return gain
    }
    this.context = context
    this.channels = { effects: channel('effects'), ambience: channel('ambience') }
    if (context.state !== 'running') this.waitForGesture()
    void this.loadAll(context)
  }

  /** Plays a sound file now (or after `delay`). Dropped while audio is locked, its channel is silent, it is gated, or it has not loaded yet. */
  play(id: string, options: PlayOptions = {}): void {
    const { context, channels } = this
    if (context === null || channels === null) return
    if (context.state !== 'running') {
      // Suspended again (a phone locked, the tab put to sleep): the next touch brings it back.
      this.waitForGesture()
      return
    }
    const channel = options.channel ?? 'effects'
    if (this.effectiveVolume(channel) === 0) return
    const takes = this.takesOf(id)
    if (takes === undefined) return

    if (options.gate !== undefined) {
      const now = performance.now()
      const last = this.lastPlayed.get(options.gate) ?? -Infinity
      if (now - last < (options.minGapMs ?? 60)) return
      this.lastPlayed.set(options.gate, now)
    }

    const vary = options.vary ?? 0
    const spread = vary === 0 ? 1 : 1 + (Math.random() * 2 - 1) * vary
    const take = takes[Math.floor(Math.random() * takes.length)]!
    const source = context.createBufferSource()
    source.buffer = take.buffer
    source.playbackRate.value = Math.max(0.05, (options.pitch ?? 1) * spread)
    const gain = context.createGain()
    gain.gain.value = Math.max(0, options.volume ?? 1)
    source.connect(gain).connect(channels[channel])
    source.addEventListener('ended', () => { gain.disconnect() })
    source.start(context.currentTime + Math.max(0, options.delay ?? 0), take.offset)

    if (options.duck !== undefined) backgroundMusic.duck(options.duck.depth, options.duck.holdMs)
  }

  /**
   * Starts a looping sound file at level 0. Steer it with the handle; always
   * stop it. If its file has not loaded yet, it starts when it does, at
   * whatever level and pitch it has been set to by then.
   */
  loop({ id, channel }: LoopSound): LoopHandle {
    const { context, channels } = this
    const silent: LoopHandle = { setLevel: () => undefined, setPitch: () => undefined, stop: () => undefined }
    if (context === null || channels === null || !LIBRARY.has(id)) {
      if (context !== null) this.warnMissing(id)
      return silent
    }

    const level = context.createGain()
    level.gain.value = 0
    level.connect(channels[channel])
    let source: AudioBufferSourceNode | null = null
    let pitch = 1
    let stopped = false

    const begin = () => {
      const takes = this.buffers.get(id)
      if (stopped || takes === undefined) return
      const { buffer } = takes[0]!
      source = context.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.playbackRate.value = pitch
      source.connect(level)
      // From a random point, so two of the same loop never start in step.
      source.start(context.currentTime, Math.random() * buffer.duration)
    }
    if (this.buffers.has(id)) begin()
    else this.waiting.set(id, [...(this.waiting.get(id) ?? []), begin])

    return {
      setLevel: (value) => {
        if (stopped) return
        level.gain.setTargetAtTime(Math.max(0, value), context.currentTime, 0.08)
      },
      setPitch: (value) => {
        if (stopped) return
        pitch = Math.max(0.05, value)
        source?.playbackRate.setTargetAtTime(pitch, context.currentTime, 0.1)
      },
      stop: () => {
        if (stopped) return
        stopped = true
        level.gain.setTargetAtTime(0, context.currentTime, 0.06)
        setTimeout(() => {
          source?.stop()
          level.disconnect()
        }, 400)
      },
    }
  }

  /* ---------------- loading ---------------- */

  private async loadAll(context: AudioContext): Promise<void> {
    const queue = [...LOAD_ORDER]
    const worker = async (): Promise<void> => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        try {
          const takes = await Promise.all(
            LIBRARY.get(id)!.map(async (url): Promise<Take> => {
              const buffer = await context.decodeAudioData(await (await fetch(url)).arrayBuffer())
              return { buffer, offset: leadIn(buffer) }
            }),
          )
          this.buffers.set(id, takes)
          this.waiting.get(id)?.forEach((begin) => { begin() })
          this.waiting.delete(id)
        } catch {
          // A file that will not load just stays silent.
        }
      }
    }
    await Promise.all(Array.from({ length: LOAD_CONCURRENCY }, worker))
  }

  private takesOf(id: string): Take[] | undefined {
    const takes = this.buffers.get(id)
    if (takes === undefined && !LIBRARY.has(id)) this.warnMissing(id)
    return takes
  }

  /** A sound asked for by an id with no file: say so once, in development. */
  private warnMissing(id: string): void {
    if (!import.meta.env.DEV || this.warned.has(id)) return
    this.warned.add(id)
    console.warn(`[sfx] No sound file for "${id}" under src/assets/audio/sfx/`)
  }

  /* ---------------- settings ---------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSettings = (): SfxSettings => this.settings

  setVolume(volume: number, channel: Channel = 'effects'): void {
    const clamped = Math.min(1, Math.max(0, volume))
    const current = this.settings[channel]
    this.update(channel, { volume: clamped, isMuted: clamped > 0 ? false : current.isMuted })
  }

  toggleMute(channel: Channel = 'effects'): void {
    const current = this.settings[channel]
    const isMuted = !current.isMuted
    // Unmuting at zero volume would still be silent: bring it back to the default.
    this.update(channel, { isMuted, volume: !isMuted && current.volume === 0 ? DEFAULTS[channel].volume : current.volume })
  }

  private update(channel: Channel, patch: Partial<ChannelSettings>): void {
    this.settings = { ...this.settings, [channel]: { ...this.settings[channel], ...patch } }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
    } catch {
      // Storage blocked: the settings just last this visit.
    }
    if (this.context !== null && this.channels !== null) {
      for (const name of CHANNELS) {
        this.channels[name].gain.setTargetAtTime(this.effectiveVolume(name), this.context.currentTime, 0.03)
      }
    }
    this.listeners.forEach((listener) => { listener() })
  }

  private effectiveVolume(channel: Channel): number {
    const { volume, isMuted } = this.settings[channel]
    // Squared, so the slider feels even to the ear.
    return isMuted ? 0 : volume * volume
  }

  /* ---------------- unlocking ---------------- */

  private readonly onGesture = (): void => {
    const context = this.context
    if (context === null) return
    context.resume().then(
      () => { if (context.state === 'running') this.stopWaitingForGesture() },
      () => undefined,
    )
  }

  private waitForGesture(): void {
    for (const type of GESTURES) window.addEventListener(type, this.onGesture, { capture: true })
  }

  private stopWaitingForGesture(): void {
    for (const type of GESTURES) window.removeEventListener(type, this.onGesture, { capture: true })
  }
}

export const sfxEngine = new SfxEngine()
