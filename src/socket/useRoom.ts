import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Ack,
  JoinAckData,
  LeaderboardPayload,
  PlaylistMode,
  ProgressPayload,
  RoomStatePayload,
  RoundResultsPayload,
  ScoreRow,
} from '../shared/protocol.ts'
import type { GameId } from '../shared/games/catalog.ts'
import { ROOM_CODE } from './config.ts'
import { clearSession, readSession, writeSession } from './session.ts'
import { useLiveRound, type LiveRound } from './useLiveRound.ts'
import { useSocket } from './useSocket.ts'

/** Where this tab is before, during and after being in a room. */
export type ArenaStage = 'title' | 'host' | 'join' | 'room'

export interface RoomActions {
  /** Show the name entry for opening a room. */
  goToHost: () => void
  /** Show the name and code entry for joining one. */
  goToJoin: () => void
  /** Leave the room and go back to the title. */
  goToTitle: () => void
  /** Open a room under this name and avatar, and own it. */
  host: (name: string, avatar: string) => void
  /** Join an existing room under this name and avatar. */
  join: (name: string, avatar: string, code: string) => void

  /* Lobby */
  setReady: (ready: boolean) => void
  /** Owner only; the server enforces that. */
  start: () => void
  setRoundsPerGame: (rounds: number) => void
  setPlaylist: (mode: PlaylistMode, gameIds?: GameId[]) => void
  /** Owner only: skip the results or leaderboard timer. */
  skip: () => void

  /* Round */
  /** Acknowledge the ready check for the round on screen. */
  readyForRound: () => void
  /** Report this player's result. The server never measures anything. */
  submitResult: (result: unknown) => void
  /** Display-only signal to the rest of the room. */
  reportProgress: (progress: unknown) => void
}

export interface UseRoomResult {
  stage: ArenaStage
  /** Null until a room has been joined and the first snapshot has arrived. */
  state: RoomStatePayload | null
  /** The round as it stands now, with the round events folded in. */
  round: LiveRound
  /** This player's id, so the UI can find them in `state.players`. */
  playerId: string | null
  results: RoundResultsPayload | null
  leaderboard: LeaderboardPayload | null
  /** Live per-player progress for the running round, keyed by player id. */
  progress: Record<string, Record<string, number>>
  /** Points as of the last resolved round, ahead of the last snapshot. */
  scores: Record<string, number>
  error: string | null
  /** A create or join is in flight. */
  busy: boolean
  actions: RoomActions
}

/**
 * Everything this tab knows about the room it is in. One tab is one player.
 *
 * The server is authoritative throughout: every action is an intent, and the
 * UI only ever renders what came back on `room:state` and the round events.
 */
export function useRoom(): UseRoomResult {
  const socket = useSocket()
  const [stage, setStage] = useState<ArenaStage>('title')
  const [state, setState] = useState<RoomStatePayload | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [results, setResults] = useState<RoundResultsPayload | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload | null>(null)
  const [progress, setProgress] = useState<Record<string, Record<string, number>>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const accept = useCallback((joined: JoinAckData, name: string, avatar: string) => {
    setPlayerId(joined.playerId)
    setState(joined.state)
    setError(null)
    setBusy(false)
    setScores({})
    setStage('room')
    writeSession({ roomCode: joined.roomCode, playerId: joined.playerId, name, avatar })
  }, [])

  const attach = useCallback(
    (name: string, avatar: string, roomCode: string | null) => {
      setBusy(true)
      setError(null)

      const settle = (ack: Ack<JoinAckData>) => {
        setBusy(false)
        if (ack.ok) accept(ack.data, name, avatar)
        else setError(ack.message)
      }

      if (roomCode === null) {
        socket.emit('room:create', { name, avatar }, settle)
        return
      }

      // Offering the stored id back to its own room reclaims the slot after a
      // reload, so a refresh mid-game does not cost you your score.
      const session = readSession()
      socket.emit(
        'room:join',
        {
          roomCode,
          name,
          avatar,
          ...(session?.roomCode === roomCode ? { playerId: session.playerId } : {}),
        },
        settle,
      )
    },
    [socket, accept],
  )

  useEffect(() => {
    // Awards only ever go up inside a competition, so folding them in can
    // never show less than the snapshot does.
    const foldScores = (rows: ScoreRow[]) => {
      setScores((current) => {
        const next = { ...current }
        for (const row of rows) next[row.playerId] = row.points
        return next
      })
    }

    const onState = (next: RoomStatePayload) => {
      setState(next)
      setError(null)
      if (next.phase !== 'leaderboard') setLeaderboard(null)
      // Back in the lobby the competition is gone and everyone is on zero.
      if (next.phase === 'lobby') setScores({})
    }
    const onResults = (payload: RoundResultsPayload) => {
      setResults(payload)
      foldScores(payload.scores)
    }
    const onScores = (payload: { scores: ScoreRow[] }) => { foldScores(payload.scores) }
    // A new round's data lands before its first progress or result, so this is
    // where the last round's leftovers go.
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
      setStage('title')
    }
    // A reconnect, or a pinned room, re-attaches under the stored identity.
    const onConnect = () => {
      const session = readSession()
      const roomCode = ROOM_CODE || session?.roomCode
      if (roomCode && session) attach(session.name, session.avatar, roomCode)
    }

    socket.on('room:state', onState)
    socket.on('round:results', onResults)
    socket.on('round:data', onRoundData)
    socket.on('competition:scores', onScores)
    socket.on('competition:leaderboard', onLeaderboard)
    socket.on('round:progress', onProgress)
    socket.on('error', onError)
    socket.on('room:closed', onClosed)
    socket.on('connect', onConnect)
    if (socket.connected) onConnect()

    return () => {
      socket.off('room:state', onState)
      socket.off('round:results', onResults)
      socket.off('round:data', onRoundData)
      socket.off('competition:scores', onScores)
      socket.off('competition:leaderboard', onLeaderboard)
      socket.off('round:progress', onProgress)
      socket.off('error', onError)
      socket.off('room:closed', onClosed)
      socket.off('connect', onConnect)
    }
  }, [socket, attach])

  const round = useLiveRound(state)
  const { roundId, attempt } = round

  const report = useCallback((ack: Ack<unknown>) => {
    if (!ack.ok) setError(ack.message)
  }, [])

  const actions = useMemo<RoomActions>(
    () => ({
      goToHost: () => {
        setError(null)
        setStage('host')
      },
      goToJoin: () => {
        setError(null)
        setStage('join')
      },
      goToTitle: () => {
        if (stage === 'room') socket.emit('room:leave', null, () => {})
        clearSession()
        setState(null)
        setPlayerId(null)
        setResults(null)
        setLeaderboard(null)
        setError(null)
        setStage('title')
      },
      host: (name: string, avatar: string) => { attach(name, avatar, null) },
      join: (name: string, avatar: string, code: string) => { attach(name, avatar, code) },

      setReady: (ready: boolean) => { socket.emit('lobby:ready', { ready }, report) },
      start: () => { socket.emit('lobby:start', null, report) },
      setRoundsPerGame: (rounds: number) => {
        socket.emit('lobby:setRounds', { roundsPerGame: rounds }, report)
      },
      setPlaylist: (mode: PlaylistMode, gameIds?: GameId[]) => {
        socket.emit('lobby:setMode', gameIds ? { mode, gameIds } : { mode }, report)
      },
      skip: () => { socket.emit('competition:skip', null, report) },

      readyForRound: () => { socket.emit('round:ready', { roundId, attempt }, report) },
      submitResult: (result: unknown) => {
        socket.emit('round:result', { roundId, attempt, result }, report)
      },
      // Unacknowledged on the wire: dropping one costs nothing.
      reportProgress: (value: unknown) => {
        socket.emit('round:progress', { roundId, attempt, progress: value })
      },
    }),
    [socket, attach, report, stage, roundId, attempt],
  )

  return {
    stage,
    state,
    round,
    playerId,
    results,
    leaderboard,
    progress,
    scores,
    error,
    busy,
    actions,
  }
}
