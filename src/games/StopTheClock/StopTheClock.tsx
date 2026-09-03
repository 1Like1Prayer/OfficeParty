import { useCallback, useEffect, useRef, useState } from 'react'
import type { StopTheClockRound } from '../../shared/games/stopTheClock.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import { PushButton } from '../../components/ui/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import { useTargetSpin } from './useTargetSpin.ts'

const isRound = (data: unknown): data is StopTheClockRound =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as StopTheClockRound).targetMs === 'number'

/**
 * Targets currently land on whole seconds, so they read as "4s"; the decimals
 * come back on their own if the step ever goes finer again.
 */
const seconds = (ms: number): string =>
  ms % 1000 === 0 ? String(ms / 1000) : (ms / 1000).toFixed(2)

/**
 * Hit the target. The clock is deliberately invisible while it runs — the
 * whole game is that you cannot see it — and the elapsed time is measured
 * here, so latency to the server cannot change who wins.
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
  const shown = decoy ?? targetMs

  useEffect(() => {
    if (phase !== 'playing') return
    onProgress({ running: true })
    const onVisibility = () => {
      if (document.hidden) suspect.current = true
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility) }
  }, [phase, onProgress])

  const stop = useCallback(() => {
    if (stoppedAt !== null) return
    const elapsedMs = performance.now() - timingStartsAtLocalMs
    setStoppedAt(elapsedMs)
    onProgress({ running: false })
    onSubmit({ elapsedMs, timingSuspect: suspect.current })
  }, [stoppedAt, timingStartsAtLocalMs, onSubmit, onProgress])

  // Space and Enter stop it too, because this is played at a desk.
  useEffect(() => {
    if (phase !== 'playing') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        stop()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [phase, stop])

  const done = stoppedAt !== null || submitted

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <div style={{ ...sharedStyles.microLabel, letterSpacing: '0.24em' }}>
        {spinning ? 'PICKING A TARGET' : 'STOP AT'}
      </div>
      <div
        // Re-keyed as it lands, so the settled number pops rather than sliding
        // out of the blur.
        key={spinning ? 'spin' : 'settled'}
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 128,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: spinning ? color.mutedSoft : color.ink,
          animation: spinning ? undefined : 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
          // The digits are proportional; pin the width so it does not jitter.
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {seconds(shown)}s
      </div>

      {phase === 'playing' &&
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
