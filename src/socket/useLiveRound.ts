import { useEffect, useState } from 'react'
import type {
  GameStartingPayload,
  ReadyStatePayload,
  RoomStatePayload,
  RoundDataPayload,
  RoundResultsPayload,
  RoundView,
  StartAtPayload,
} from '../shared/protocol.ts'
import { useSocket } from './useSocket.ts'

export interface LiveRound extends RoundView {
  /**
   * `performance.now()` value the clock starts running at, derived from the
   * server's own "now" in the same payload — no clock sync needed, because
   * the arena only displays the countdown, it never times anything.
   */
  timingStartsAtLocalMs: number | null
  /** Public round data, e.g. Stop the Clock's target. */
  data: unknown
}

/** Fields the round events refine, tagged with the round they describe. */
type RoundOverlay = Partial<LiveRound> & { roundId: number }

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
  data: null,
}

/**
 * The round as it actually stands.
 *
 * `room:state` carries an accurate round view whenever it is sent, but the
 * server does not re-broadcast state as a round moves from ready-check to
 * countdown to playing — those transitions are the round events. So the
 * snapshot seeds this view and the events drive it.
 */
export function useLiveRound(state: RoomStatePayload | null): LiveRound {
  const socket = useSocket()
  const [overlay, setRound] = useState<RoundOverlay>({ roundId: -1 })

  useEffect(() => {
    const onGameStarting = (payload: GameStartingPayload) => {
      setRound((current) => ({
        ...current,
        ...payload,
        phase: 'loading',
        // A fresh game, so nothing from the previous round survives.
        ready: [],
        waitingFor: [],
        startAtServerMs: null,
        timingStartsAtLocalMs: null,
        data: null,
      }))
    }

    const onRoundData = (payload: RoundDataPayload) => {
      setRound((current) => ({
        ...current,
        roundId: payload.roundId,
        attempt: payload.attempt,
        gameId: payload.gameId,
        gameIndex: payload.gameIndex,
        totalGames: payload.totalGames,
        roundInGame: payload.roundInGame,
        isTiebreak: payload.isTiebreak,
        participants: payload.participants,
        phase: 'ready-check',
        data: payload.data,
      }))
    }

    const onReadyState = (payload: ReadyStatePayload) => {
      setRound((current) =>
        current.roundId === payload.roundId
          ? { ...current, ready: payload.ready, waitingFor: payload.waitingFor }
          : current,
      )
    }

    const onResults = (payload: RoundResultsPayload) => {
      setRound((current) =>
        current.roundId === payload.roundId ? { ...current, phase: 'results' } : current,
      )
    }

    socket.on('competition:gameStarting', onGameStarting)
    socket.on('round:data', onRoundData)
    socket.on('round:readyState', onReadyState)
    socket.on('round:results', onResults)
    return () => {
      socket.off('competition:gameStarting', onGameStarting)
      socket.off('round:data', onRoundData)
      socket.off('round:readyState', onReadyState)
      socket.off('round:results', onResults)
    }
  }, [socket])

  // The start is scheduled ahead of time, so the countdown and the clock
  // running are local timers rather than further messages.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    const onStartAt = (payload: StartAtPayload) => {
      const untilCountdown = payload.startAtServerMs - payload.serverTimeMs
      const untilTiming = payload.timingStartsAtServerMs - payload.serverTimeMs
      const timingStartsAtLocalMs = performance.now() + untilTiming

      const advance = (phase: 'countdown' | 'playing') => {
        setRound((current) =>
          current.roundId === payload.roundId && current.attempt === payload.attempt
            ? { ...current, phase }
            : current,
        )
      }

      setRound((current) =>
        current.roundId === payload.roundId
          ? {
              ...current,
              phase: 'starting',
              startAtServerMs: payload.startAtServerMs,
              timingStartsAtLocalMs,
            }
          : current,
      )
      timers.push(setTimeout(() => { advance('countdown') }, Math.max(0, untilCountdown)))
      timers.push(setTimeout(() => { advance('playing') }, Math.max(0, untilTiming)))
    }

    socket.on('round:startAt', onStartAt)
    return () => {
      socket.off('round:startAt', onStartAt)
      timers.forEach(clearTimeout)
    }
  }, [socket])

  const snapshot = state?.round

  // The snapshot is the floor; the events layer on top of it, and an overlay
  // left over from an earlier round is dropped rather than shown.
  if (!snapshot) return { ...IDLE, ...overlay }
  return overlay.roundId >= snapshot.roundId
    ? { ...IDLE, ...snapshot, ...overlay }
    : { ...IDLE, ...snapshot }
}
