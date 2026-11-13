import { useEffect, useState } from 'react'
import type { RoundPhase } from '../shared/protocol.ts'
import type { LocalSchedule, PartySnapshot } from './partyConnection.ts'
import type { RoundView } from './roomView.ts'

export interface LiveRound extends RoundView {
  /**
   * `performance.now()` value the clock starts running at. Fixed for the
   * attempt once known; games measure their player from it.
   */
  timingStartsAtLocalMs: number | null
  /**
   * How long this attempt's countdown runs, as the server scheduled it. Games
   * can lengthen it (the heats do, to fit their opening animation).
   */
  countdownMs: number | null
  /** Public round data, e.g. Stop the Clock's target. */
  data: unknown
}

const IDLE: LiveRound = {
  phase: 'idle',
  roundId: 0,
  attempt: 0,
  gameId: null,
  gameIndex: 0,
  totalGames: 0,
  roundInGame: 0,
  roundsPerGame: 0,
  isTiebreak: false,
  participants: [],
  ready: [],
  waitingFor: [],
  startAtServerMs: null,
  timingStartsAtLocalMs: null,
  countdownMs: null,
  data: null,
}

const PHASE_ORDER: readonly RoundPhase[] = [
  'idle', 'loading', 'ready-check', 'starting', 'countdown', 'playing', 'results',
]
const rankOf = (phase: RoundPhase): number => PHASE_ORDER.indexOf(phase)

/**
 * The round as it actually stands on this screen.
 *
 * The server's phase arrives with the next state patch. But the start is
 * scheduled seconds ahead, so the countdown and the clock running are local
 * timers at the scheduled instants, never later than the server says. The
 * round only leaves `loading` once its data has arrived.
 */
export function useLiveRound(snapshot: PartySnapshot | null): LiveRound {
  const round = snapshot?.room.round ?? null
  const schedule = matching(snapshot?.schedule ?? null, round)
  const roundData = matching(snapshot?.events.roundData ?? null, round)
  const nowMs = useNowAtBoundaries(schedule)

  if (round === null) return IDLE

  return {
    ...round,
    phase: displayPhase(round.phase, schedule, nowMs, roundData !== null),
    timingStartsAtLocalMs: schedule?.timingStartsAtLocalMs ?? null,
    countdownMs: schedule?.countdownMs ?? null,
    data: roundData?.data ?? null,
  }
}

/** Only something tagged with the round on screen counts. */
function matching<T extends { roundId: number; attempt: number }>(
  value: T | null,
  round: RoundView | null,
): T | null {
  return value !== null && round !== null &&
    value.roundId === round.roundId && value.attempt === round.attempt
    ? value
    : null
}

function displayPhase(
  serverPhase: RoundPhase,
  schedule: LocalSchedule | null,
  nowMs: number,
  hasData: boolean,
): RoundPhase {
  if (serverPhase === 'idle' || serverPhase === 'results') return serverPhase
  if (!hasData) return 'loading'
  if (schedule === null) return serverPhase

  const scheduled: RoundPhase =
    nowMs >= schedule.timingStartsAtLocalMs ? 'playing'
      : nowMs >= schedule.startAtLocalMs ? 'countdown'
        : 'starting'
  return rankOf(scheduled) > rankOf(serverPhase) ? scheduled : serverPhase
}

/** A `performance.now()` reading that refreshes exactly when the next scheduled instant passes. */
function useNowAtBoundaries(schedule: LocalSchedule | null): number {
  const [nowMs, setNowMs] = useState(() => performance.now())
  const boundaries = schedule === null ? [] : [schedule.startAtLocalMs, schedule.timingStartsAtLocalMs]
  const nextBoundaryMs = boundaries.find((boundaryMs) => boundaryMs > nowMs)

  useEffect(() => {
    if (nextBoundaryMs === undefined) return
    const timer = setTimeout(() => {
      // Never read as just short of the boundary, or this would wait forever.
      setNowMs(Math.max(performance.now(), nextBoundaryMs))
    }, Math.max(0, nextBoundaryMs - performance.now()))
    return () => { clearTimeout(timer) }
  }, [nextBoundaryMs])

  return nowMs
}
