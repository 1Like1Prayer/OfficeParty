import trackUrl from '../assets/audio/background-music.mp3'

/**
 * The site's background music: one looping track, shared by the whole app.
 *
 * It starts as soon as the page loads, at 60% volume. Browsers refuse to play
 * sound before the visitor has touched the page, so if that first attempt is
 * blocked it starts on their first click, tap or key press instead.
 *
 * The visitor's volume, mute and pause are remembered in this browser, so
 * someone who paused it is not greeted by it on their next visit.
 */

export const TRACK_TITLE = 'Background Music'
const DEFAULT_VOLUME = 0.6
const STORAGE_KEY = 'office-party.music'

export interface MusicState {
  isPlaying: boolean
  /** The browser blocked the autoplay; it starts on the visitor's first interaction. */
  isWaitingForGesture: boolean
  currentTime: number
  duration: number
  /** 0–1. */
  volume: number
  isMuted: boolean
}

interface Saved {
  volume: number
  isMuted: boolean
  isPaused: boolean
}

function load(): Saved {
  const fallback: Saved = { volume: DEFAULT_VOLUME, isMuted: false, isPaused: false }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return fallback
    const saved = JSON.parse(raw) as Partial<Saved>
    return {
      volume: typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : fallback.volume,
      isMuted: saved.isMuted === true,
      isPaused: saved.isPaused === true,
    }
  } catch {
    return fallback
  }
}

function save(saved: Saved): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // Storage blocked (a private window): the settings just last this visit.
  }
}

const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const

class BackgroundMusic {
  private audio: HTMLAudioElement | null = null
  private readonly listeners = new Set<() => void>()
  /** Whether the visitor wants it playing; false once they press pause. */
  private wantsToPlay: boolean
  private state: MusicState

  constructor() {
    const saved = load()
    this.wantsToPlay = !saved.isPaused
    this.state = {
      isPlaying: false,
      isWaitingForGesture: false,
      currentTime: 0,
      duration: 0,
      volume: saved.volume,
      isMuted: saved.isMuted,
    }
  }

  /** Starts it, as the page loads. Safe to call more than once. */
  start(): void {
    if (this.audio !== null) return
    const audio = new Audio(trackUrl)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = this.state.volume
    audio.muted = this.state.isMuted
    audio.addEventListener('play', () => { this.set({ isPlaying: true, isWaitingForGesture: false }) })
    audio.addEventListener('pause', () => { this.set({ isPlaying: false }) })
    audio.addEventListener('timeupdate', () => { this.set({ currentTime: audio.currentTime }) })
    audio.addEventListener('loadedmetadata', () => { this.set({ duration: audio.duration }) })
    audio.addEventListener('durationchange', () => { this.set({ duration: audio.duration }) })
    this.audio = audio
    if (this.wantsToPlay) this.tryPlay()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getState = (): MusicState => this.state

  play(): void {
    this.wantsToPlay = true
    this.persist()
    this.tryPlay()
  }

  pause(): void {
    this.wantsToPlay = false
    this.persist()
    this.stopWaitingForGesture()
    this.set({ isWaitingForGesture: false })
    this.audio?.pause()
  }

  toggle(): void {
    if (this.state.isPlaying || this.state.isWaitingForGesture) this.pause()
    else this.play()
  }

  seek(seconds: number): void {
    const audio = this.audio
    if (audio === null || !Number.isFinite(audio.duration)) return
    audio.currentTime = Math.min(audio.duration, Math.max(0, seconds))
    this.set({ currentTime: audio.currentTime })
  }

  skip(seconds: number): void {
    this.seek(this.state.currentTime + seconds)
  }

  setVolume(volume: number): void {
    const clamped = Math.min(1, Math.max(0, volume))
    if (this.audio !== null) {
      this.audio.volume = clamped
      // Turning it up from silent unmutes it, as a volume knob would.
      if (clamped > 0 && this.audio.muted) this.audio.muted = false
    }
    this.set({ volume: clamped, isMuted: clamped > 0 ? false : this.state.isMuted })
    this.persist()
  }

  toggleMute(): void {
    const isMuted = !this.state.isMuted
    if (this.audio !== null) this.audio.muted = isMuted
    // Unmuting at zero volume would still be silent: bring it back to the default.
    if (!isMuted && this.state.volume === 0) this.setVolume(DEFAULT_VOLUME)
    this.set({ isMuted })
    this.persist()
  }

  private tryPlay(): void {
    const audio = this.audio
    if (audio === null) return
    audio.play().catch(() => {
      // Autoplay blocked until the visitor interacts with the page.
      this.set({ isWaitingForGesture: true })
      this.waitForGesture()
    })
  }

  private readonly onGesture = (): void => {
    this.stopWaitingForGesture()
    if (this.wantsToPlay && !this.state.isPlaying) this.tryPlay()
  }

  private waitForGesture(): void {
    for (const type of GESTURES) window.addEventListener(type, this.onGesture, { capture: true, once: true })
  }

  private stopWaitingForGesture(): void {
    for (const type of GESTURES) window.removeEventListener(type, this.onGesture, { capture: true })
  }

  private persist(): void {
    save({ volume: this.state.volume, isMuted: this.state.isMuted, isPaused: !this.wantsToPlay })
  }

  private set(patch: Partial<MusicState>): void {
    const next = { ...this.state, ...patch }
    const changed = (Object.keys(patch) as (keyof MusicState)[]).some((key) => next[key] !== this.state[key])
    if (!changed) return
    this.state = next
    this.listeners.forEach((listener) => { listener() })
  }
}

export const backgroundMusic = new BackgroundMusic()
