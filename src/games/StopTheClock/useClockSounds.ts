import { useEffect, useRef } from 'react'
import { sfx, useSoundOnChange } from '../../audio/sfx/index.ts'
import type { RankedEntry } from '../../shared/games/selfTimed.ts'
import { STOP_THE_CLOCK_TIMELINE } from './tvShow.ts'

const { ROLL_MS, LAND_MS, ROLL_FRAME_MS, blindHidesAtMs } = STOP_THE_CLOCK_TIMELINE
/** Tick, tock: twice a second, like a real stopwatch. */
const TICK_MS = 500

interface ClockSoundsInput {
  timingStartsAtLocalMs: number
  targetMs: number
  isBlind: boolean
  /** The clock is running for this player (not stopped, results not in). */
  isRunning: boolean
  /** How many others have stopped. */
  lockedInCount: number
  ranking: readonly RankedEntry[] | null
  selfPlayerId: string
}

/**
 * Stop the Clock's sounds, on the same timeline the TVs draw: a clack for each
 * number of the target roll and a clunk as it lands, the stopwatch ticking
 * while it runs (falling silent with the clock on a blind target, so the ear
 * cannot count what the eye no longer sees), a blip as others lock in, and
 * a bullseye or a womp when the target's results come in.
 */
export function useClockSounds({
  timingStartsAtLocalMs,
  targetMs,
  isBlind,
  isRunning,
  lockedInCount,
  ranking,
  selfPlayerId,
}: ClockSoundsInput): void {
  const running = useRef(isRunning)
  useEffect(() => { running.current = isRunning }, [isRunning])

  useEffect(() => {
    let rollFrame = -1
    let hasLanded = performance.now() - timingStartsAtLocalMs >= LAND_MS
    let tick = -1
    const silentFromMs = isBlind ? blindHidesAtMs(targetMs) : Infinity

    let frame = requestAnimationFrame(function step() {
      const sinceMs = performance.now() - timingStartsAtLocalMs
      if (sinceMs >= ROLL_MS && sinceMs < LAND_MS) {
        const index = Math.floor((sinceMs - ROLL_MS) / ROLL_FRAME_MS)
        if (index !== rollFrame) {
          rollFrame = index
          sfx.stopTheClock.rollClack()
        }
      } else if (sinceMs >= LAND_MS && !hasLanded) {
        hasLanded = true
        sfx.stopTheClock.rollLand()
      }
      if (sinceMs >= 0 && sinceMs < silentFromMs && running.current) {
        const index = Math.floor(sinceMs / TICK_MS)
        if (index !== tick) {
          tick = index
          sfx.stopTheClock.tick(index % 2 === 1)
        }
      }
      frame = requestAnimationFrame(step)
    })
    return () => { cancelAnimationFrame(frame) }
  }, [timingStartsAtLocalMs, targetMs, isBlind])

  useSoundOnChange(lockedInCount, (next, previous) => { if (next > previous) sfx.stopTheClock.otherLockedIn() })

  useSoundOnChange(ranking, (next) => {
    if (next === null || next.length < 2) return
    const own = next.find(({ playerId }) => playerId === selfPlayerId)
    if (own === undefined) return
    const worst = Math.max(...next.map(({ rank }) => rank))
    if (own.rank === 1) sfx.stopTheClock.bullseye()
    else if (own.rank === worst) sfx.stopTheClock.womp()
  })
}
