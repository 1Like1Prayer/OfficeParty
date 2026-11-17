import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StopTheClockRound } from '../../shared/games/stopTheClock.ts'
import { color, fluid, font } from '../../theme/index.ts'
import { PushButton } from '../../components/ui/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import { TvIntro } from '../ui/TvIntro.tsx'
import { stopTheClockShow } from './tvShow.ts'

const isRound = (data: unknown): data is StopTheClockRound =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as StopTheClockRound).targetMs === 'number' &&
  typeof (data as StopTheClockRound).targetIndex === 'number'

/**
 * Hit the target, four times running. The whole round is played on the TV in
 * front of the player (see tvShow.ts): each target, the running clock, where
 * they stopped, and between targets how everyone did. Only the STOP button
 * sits over the picture. Each target is its own attempt of the round (a stage),
 * and this stays mounted from the first to the last.
 *
 * The clock is measured here with `performance.now()`, so latency to the
 * server cannot change who wins, and the number on the TV is drawn from the
 * same start time the result is taken from.
 */
export function StopTheClock({
  players,
  selfPlayerId,
  progress,
  phase,
  data,
  attemptKey,
  finalRanking,
  timingStartsAtLocalMs,
  submitted,
  onSubmit,
  onProgress,
}: GameSurfaceProps) {
  // Where the player stopped, for this target only.
  const [lastStop, setLastStop] = useState<{ attemptKey: string; atMs: number } | null>(null)
  const stoppedAt = lastStop !== null && lastStop.attemptKey === attemptKey ? lastStop.atMs : null
  // A throttled tab has a throttled timer, so say so rather than score it.
  const suspect = useRef(false)

  // 'playing' carries on through the target's results; the clock only runs until they arrive.
  const playing = phase === 'playing' && finalRanking === null
  const done = stoppedAt !== null || submitted

  // The TV picture, built once per target; it is told how the round stands as that changes.
  const tvShow = useMemo(() => (isRound(data) ? stopTheClockShow(data) : null), [data])
  const names = useMemo(
    () => Object.fromEntries(players.map(({ playerId, name }) => [playerId, name])),
    [players],
  )
  useEffect(() => {
    tvShow?.setLive({
      phase,
      stoppedAtMs: stoppedAt,
      isLockedIn: submitted,
      // Others report `running: 0` once they have stopped.
      lockedInIds: new Set(
        Object.entries(progress)
          .filter(([, report]) => report.running === 0)
          .map(([playerId]) => playerId),
      ),
      ranking: finalRanking,
      names,
    })
  }, [tvShow, phase, stoppedAt, submitted, progress, finalRanking, names])

  useEffect(() => {
    if (!playing) return
    suspect.current = false
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
    setLastStop({ attemptKey, atMs: stopped })
    onProgress({ running: false })
    onSubmit({ elapsedMs: stopped, timingSuspect: suspect.current })
  }, [stoppedAt, attemptKey, timingStartsAtLocalMs, onSubmit, onProgress])

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

  if (tvShow === null) return null
  return (
    <TvIntro players={players} selfPlayerId={selfPlayerId} timingStartsAtLocalMs={timingStartsAtLocalMs} show={tvShow}>
      {playing && (
        // Along the bottom, under the screen. Only the controls take clicks; the picture never does.
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 'max(22px, env(safe-area-inset-bottom))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: fluid(8, 10),
            padding: '0 16px',
            textAlign: 'center',
            animation: 'pa-fade-up .35s ease-out both',
          }}
        >
          {done ? (
            <div
              style={{
                padding: '10px 20px',
                borderRadius: 999,
                background: 'rgba(14, 9, 36, 0.72)',
                border: `3px solid ${color.ink}`,
                color: color.cream,
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: fluid(16, 20),
                animation: 'pa-pulse 2s ease-in-out infinite',
              }}
            >
              Waiting for everyone else…
            </div>
          ) : (
            <>
              {/* Wide enough to hit without looking, on a phone as much as a desk. */}
              <div style={{ width: fluid(200, 260), maxWidth: '100%', pointerEvents: 'auto' }}>
                <PushButton size="lg" variant="success" fullWidth onClick={stop}>
                  STOP
                </PushButton>
              </div>
              <div style={{ fontFamily: font.mono, fontSize: fluid(11, 13), color: color.cream, opacity: 0.75 }}>
                CLICK, TAP, OR HIT SPACE
              </div>
            </>
          )}
        </div>
      )}
    </TvIntro>
  )
}
