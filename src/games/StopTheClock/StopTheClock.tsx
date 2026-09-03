import { useCallback, useEffect, useRef, useState } from 'react'
import type { StopTheClockRound } from '../../shared/games/stopTheClock.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import { PushButton } from '../../components/ui/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import { useElapsed } from './useElapsed.ts'
import { useTargetSpin } from './useTargetSpin.ts'

const isRound = (data: unknown): data is StopTheClockRound =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as StopTheClockRound).targetMs === 'number'

/**
 * Targets land on whole seconds, so they read as "4s"; the decimals come back
 * on their own if the step ever goes finer again.
 */
const target = (ms: number): string =>
  ms % 1000 === 0 ? String(ms / 1000) : (ms / 1000).toFixed(2)

/** The running clock always shows hundredths — that is the margin being played for. */
const clock = (ms: number): string => (ms / 1000).toFixed(2)

/**
 * Hit the target. The clock is measured here with `performance.now()`, so
 * latency to the server cannot change who wins, and what the player watches is
 * the same number their result is taken from.
 */
export function StopTheClock({
  phase,
  data,
  timingStartsAtLocalMs,
  submitted,
  onSubmit,
  onProgress,
}: GameSurfaceProps) {
  const [stoppedAt, setStoppedAt] = useState<number | null>(null)
  // A throttled tab has a throttled timer, so say so rather than score it.
  const suspect = useRef(false)

  const targetMs = isRound(data) ? data.targetMs : 0
  const spinning = phase === 'starting'
  const decoy = useTargetSpin(spinning)
  const playing = phase === 'playing'
  const done = stoppedAt !== null || submitted

  const elapsedMs = useElapsed(timingStartsAtLocalMs, playing && !done)

  useEffect(() => {
    if (!playing) return
    onProgress({ running: true })
    const onVisibility = () => {
      if (document.hidden) suspect.current = true
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility) }
  }, [playing, onProgress])

  const stop = useCallback(() => {
    if (stoppedAt !== null) return
    const stopped = performance.now() - timingStartsAtLocalMs
    setStoppedAt(stopped)
    onProgress({ running: false })
    onSubmit({ elapsedMs: stopped, timingSuspect: suspect.current })
  }, [stoppedAt, timingStartsAtLocalMs, onSubmit, onProgress])

  // Space and Enter stop it too, because this is played at a desk.
  useEffect(() => {
    if (!playing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        stop()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [playing, stop])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div
        style={{
          ...sharedStyles.microLabel,
          letterSpacing: '0.22em',
          // The target is the thing being played against, so it stays legible
          // from across the desk once the clock is running.
          fontSize: playing ? 26 : 15,
          color: playing ? color.ink : color.mutedStrong,
        }}
      >
        {spinning ? 'PICKING A TARGET' : playing ? `STOP AT ${target(targetMs)}s` : 'STOP AT'}
      </div>

      <div
        // Re-keyed as it lands, so the settled number pops rather than sliding
        // out of the blur.
        key={spinning ? 'spin' : playing ? 'clock' : 'settled'}
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 128,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: spinning ? color.mutedSoft : done ? color.mutedStrong : color.ink,
          animation: spinning || playing ? undefined : 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
          // The digits are proportional; pin the width so it does not jitter.
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {playing
          ? `${clock(stoppedAt ?? elapsedMs)}s`
          : `${target(decoy ?? targetMs)}s`}
      </div>

      {playing &&
        (done ? (
          <div
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 30,
              color: color.mutedStrong,
              animation: 'pa-pulse 2s ease-in-out infinite',
            }}
          >
            Locked in. Waiting for everyone else…
          </div>
        ) : (
          <>
            <PushButton size="lg" variant="success" onClick={stop}>
              STOP
            </PushButton>
            <div style={{ fontFamily: font.mono, fontSize: 13, color: color.mutedStrong }}>
              CLICK, TAP, OR HIT SPACE
            </div>
          </>
        ))}
    </div>
  )
}
