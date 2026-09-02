import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Ack,
  JoinAckData,
  LeaderboardPayload,
  ProgressPayload,
  RoomStatePayload,
  RoundResultsPayload,
} from '../shared/protocol.ts'
import { DISPLAY_NAME, ROOM_CODE } from './config.ts'
import { clearSession, readSession, writeSession } from './session.ts'
import { useLiveRound, type LiveRound } from './useLiveRound.ts'
import { useSocket } from './useSocket.ts'

export interface RoomActions {
  /** Lobby: begin the competition. Owner only; the server enforces that. */
  start: () => void
  /** Results or leaderboard: skip the timer and move on. Owner only. */
  skip: () => void
  setRoundsPerGame: (rounds: number) => void
}

export interface UseRoomResult {
  /** Null until the room has been joined and the first snapshot has arrived. */
  state: RoomStatePayload | null
  /**
   * The round as it stands now. `state.round` is only as fresh as the last
   * snapshot; this folds the round events in on top of it.
   */
  round: LiveRound
  /** This screen's own player id, so it can find itself in `state.players`. */
  playerId: string | null
  /** Last round's reveal, kept until the next round replaces it. */
  results: RoundResultsPayload | null
  /** Final standings, set when the competition ends. */
  leaderboard: LeaderboardPayload | null
  /** Live per-player progress for the running round, keyed by player id. */
  progress: Record<string, Record<string, number>>
  error: string | null
  actions: RoomActions
}

/**
 * Binds this screen to one room. The arena joins as a `display`: it owns the
 * room and drives start/skip, but the server never counts it as a player, so
 * it neither blocks a ready check nor shows up in the standings.
 *
 * The server is authoritative throughout — every action is an intent, and the
 * UI only ever renders what came back on `room:state`.
 */
export function useRoom(): UseRoomResult {
  const socket = useSocket()
  const [state, setState] = useState<RoomStatePayload | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [results, setResults] = useState<RoundResultsPayload | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload | null>(null)
  const [progress, setProgress] = useState<Record<string, Record<string, number>>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const accept = (joined: JoinAckData) => {
      setPlayerId(joined.playerId)
      setState(joined.state)
      setError(null)
      writeSession({ roomCode: joined.roomCode, playerId: joined.playerId })
    }

    const create = () => {
      socket.emit('room:create', { name: DISPLAY_NAME, display: true }, (ack) => {
        if (cancelled) return
        if (ack.ok) accept(ack.data)
        else setError(ack.message)
      })
    }

    /** Reclaim the held slot if there is one, else take a fresh one. */
    const attach = () => {
      const session = readSession()
      const roomCode = ROOM_CODE || session?.roomCode

      if (!roomCode) {
        create()
        return
      }

      socket.emit(
        'room:join',
        {
          roomCode,
          name: DISPLAY_NAME,
          display: true,
          // Only offer the stored id back to the room it belongs to.
          ...(session && session.roomCode === roomCode
            ? { playerId: session.playerId }
            : {}),
        },
        (ack) => {
          if (cancelled) return
          if (ack.ok) {
            accept(ack.data)
            return
          }
          clearSession()
          // A pinned room that has gone away is an error worth showing; an
          // expired room we invented ourselves is not — just make a new one.
          if (ROOM_CODE) setError(ack.message)
          else create()
        },
      )
    }

    const onState = (next: RoomStatePayload) => {
      setState(next)
      setError(null)
      if (next.phase !== 'leaderboard') setLeaderboard(null)
    }
    const onResults = (payload: RoundResultsPayload) => { setResults(payload) }
    // A new round's data lands before its first progress or result, so this is
    // where last round's leftovers go.
    const onRoundData = () => {
      setResults(null)
      setProgress({})
    }
    const onLeaderboard = (payload: LeaderboardPayload) => { setLeaderboard(payload) }
    const onProgress = (payload: ProgressPayload) => {
      setProgress((current) => ({ ...current, [payload.playerId]: payload.progress }))
    }
    const onError = (payload: { message: string }) => { setError(payload.message) }
    const onClosed = () => {
      clearSession()
      setState(null)
      setPlayerId(null)
      attach()
    }

    socket.on('room:state', onState)
    socket.on('round:results', onResults)
    socket.on('round:data', onRoundData)
    socket.on('competition:leaderboard', onLeaderboard)
    socket.on('round:progress', onProgress)
    socket.on('error', onError)
    socket.on('room:closed', onClosed)
    socket.on('connect', attach)
    if (socket.connected) attach()

    return () => {
      cancelled = true
      socket.off('room:state', onState)
      socket.off('round:results', onResults)
      socket.off('round:data', onRoundData)
      socket.off('competition:leaderboard', onLeaderboard)
      socket.off('round:progress', onProgress)
      socket.off('error', onError)
      socket.off('room:closed', onClosed)
      socket.off('connect', attach)
    }
  }, [socket])

  const round = useLiveRound(state)

  const report = useCallback((ack: Ack<unknown>) => {
    if (!ack.ok) setError(ack.message)
  }, [])

  const actions = useMemo<RoomActions>(
    () => ({
      start: () => { socket.emit('lobby:start', null, report) },
      skip: () => { socket.emit('competition:skip', null, report) },
      setRoundsPerGame: (rounds: number) => {
        socket.emit('lobby:setRounds', { roundsPerGame: rounds }, report)
      },
    }),
    [socket, report],
  )

  return { state, round, playerId, results, leaderboard, progress, error, actions }
}
