import { useEffect, useRef, useSyncExternalStore } from 'react'
import { sfxEngine, type LoopHandle, type LoopSound, type SfxSettings } from './engine.ts'

/** The effects' volume and mute, kept up to date. */
export function useSfxSettings(): SfxSettings {
  return useSyncExternalStore(sfxEngine.subscribe, sfxEngine.getSettings)
}

/**
 * Calls `onChange` whenever `value` changes after the first render — for a
 * sound that marks a change on screen (a new beat, a player joining) and must
 * not play just because the screen opened on it.
 */
export function useSoundOnChange<T>(value: T, onChange: (next: T, previous: T) => void): void {
  const previous = useRef(value)
  const handler = useRef(onChange)
  useEffect(() => { handler.current = onChange })
  useEffect(() => {
    const before = previous.current
    previous.current = value
    if (!Object.is(before, value)) handler.current(value, before)
  }, [value])
}

/**
 * A looping sound that runs while `active`, at `level` (0–1) and `pitch`
 * (a playback-rate multiplier), and stops when it is not or the screen goes.
 * Pass one of the `…Loop` sounds from `sfx` (a constant).
 */
export function useLoop(loop: LoopSound, active: boolean, level: number, pitch = 1): void {
  const handle = useRef<LoopHandle | null>(null)

  useEffect(() => {
    if (!active) return
    const running = sfxEngine.loop(loop)
    handle.current = running
    return () => {
      running.stop()
      if (handle.current === running) handle.current = null
    }
  }, [active, loop])

  useEffect(() => { handle.current?.setLevel(active ? level : 0) }, [active, level])
  useEffect(() => { handle.current?.setPitch(pitch) }, [pitch])
}

/**
 * Plays `play` at random intervals, between `minMs` and `maxMs` apart, while
 * `active` — for ambience that calls out now and then (gulls over the sea)
 * rather than running continuously. The first call comes partway into the
 * first interval, so it never lands the moment the screen opens.
 */
export function useAmbientCalls(play: () => void, active: boolean, minMs: number, maxMs: number): void {
  const handler = useRef(play)
  useEffect(() => { handler.current = play })

  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = (scale: number) => {
      timer = setTimeout(() => {
        handler.current()
        schedule(1)
      }, (minMs + Math.random() * (maxMs - minMs)) * scale)
    }
    schedule(0.5)
    return () => { clearTimeout(timer) }
  }, [active, minMs, maxMs])
}
