import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Room } from '@colyseus/sdk'
import { PROTOCOL_VERSION } from '../shared/constants.ts'
import type { GameId } from '../shared/games/catalog.ts'
import {
  ClientMessage,
  ClientRequest,
  KICKED_CODE,
  PARTY_ROOM_NAME,
  type JoinOptions,
  type LeaderboardPayload,
  type PlaylistMode,
  type RoundClosingPayload,
  type RoundResultsPayload,
} from '../shared/protocol.ts'
import type { NextStageView } from '../types/index.ts'
import { describeJoinError, describeRequestError } from './errors.ts'
import { PartyConnection } from './partyConnection.ts'
import { toScores, type ProgressByPlayer, type RoomView } from './roomView.ts'
import { clearSession, readSession, writeSession } from './session.ts'
import { useLiveRound, type LiveRound } from './useLiveRound.ts'
import { useNetwork, usePartySnapshot } from './useNetwork.ts'

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
  setPlaylist: (mode: PlaylistMode, gameIds?: GameId[]) => void
  /** Owner only: skip the results or leaderboard timer. */
  skip: () => void
  /** Owner only: abandon the current game for the next one, or the final scores after the last. */
  skipGame: () => void
  /** Owner only: end the competition and bring everyone back to the lobby. */
  backToLobby: () => void
  /** Owner only: remove a player from the room. */
  kick: (playerId: string) => void

  /* Round */
  /** Acknowledge the ready check for the round on screen. */
  readyForRound: () => void
  /** Report this player's result. The server never measures anything. */
  submitResult: (result: unknown) => void
  /** Display-only signal to the rest of the room. */
  reportProgress: (progress: unknown) => void
  /**
   * Ask the game something only the server can answer mid-round, such as the
   * outcome of a dice roll. Resolves with the server's reply, or rejects with
   * the reason it refused.
   */
  sendAction: (action: unknown) => Promise<unknown>
}

export interface UseRoomResult {
  stage: ArenaStage
  /** Null until a room has been joined. */
  state: RoomView | null
  /** The round as it stands on this screen. */
  round: LiveRound
  /** This player's id, so the UI can find them in `state.players`. */
  playerId: string | null
  results: RoundResultsPayload | null
  leaderboard: LeaderboardPayload | null
  /** Set once the server is waiting only on the players it lists to report. */
  closing: RoundClosingPayload | null
  /** Live per-player progress for the running round, keyed by player id. */
  progress: ProgressByPlayer
  /** Set while a round goes on to another stage (heats -> final). */
  nextStage: NextStageView | null
  /** `performance.now()` value the game's ending animation runs until, if any. */
  finishAnimationEndsAtLocalMs: number | null
  /** Points per player. */
  scores: Record<string, number>
  error: string | null
  /** A create, join or rejoin is in flight. */
  busy: boolean
  actions: RoomActions
}

/** An error belongs to the room view it was raised against; any change clears it. */
interface RaisedError {
  message: string
  against: RoomView | null
}

const NO_PROGRESS: ProgressByPlayer = {}

/**
 * Everything this tab knows about the room it is in. One tab is one player.
 *
 * The server is authoritative throughout: every action is an intent, and the
 * UI renders only what comes back in the synced state and the round messages.
 */
export function useRoom(): UseRoomResult {
  const { client, connection, setConnection, setFatalError } = useNetwork()
  const snapshot = usePartySnapshot()
  const [screen, setScreen] = useState<Exclude<ArenaStage, 'room'>>('title')
  // A stored seat is rejoined on load, so the tab starts busy.
  const [busy, setBusy] = useState(() => readSession() !== null)
  const [raised, setRaised] = useState<RaisedError | null>(null)

  const room = snapshot?.room ?? null
  const round = useLiveRound(snapshot)
  const error = raised !== null && raised.against === room ? raised.message : null
  const raise = useCallback((message: string, against: RoomView | null) => {
    setRaised({ message, against })
  }, [])

  /** Seat this tab in a joined room and remember it for reloads. */
  const enter = useCallback(
    async (joined: Room, name: string, avatar: string) => {
      const next = await PartyConnection.open(joined, (code) => {
        // The room ended without us leaving it: kicked, closed, or the seat expired.
        clearSession()
        setConnection(null)
        setScreen('title')
        raise(code === KICKED_CODE ? 'The host removed you from the room.' : 'The room has closed.', null)
      })
      writeSession({
        roomCode: joined.roomId,
        reconnectionToken: joined.reconnectionToken,
        name,
        avatar,
      })
      setRaised(null)
      setConnection(next)
    },
    [setConnection, raise],
  )

  const attach = useCallback(
    async (name: string, avatar: string, roomCode: string | null) => {
      setBusy(true)
      setRaised(null)
      const options: JoinOptions = { protocolVersion: PROTOCOL_VERSION, name, avatar }
      try {
        const joined = roomCode === null
          ? await client.create(PARTY_ROOM_NAME, options)
          : await client.joinById(roomCode.toUpperCase(), options)
        await enter(joined, name, avatar)
      } catch (failure) {
        const { fatal, message } = describeJoinError(failure)
        if (fatal) setFatalError(message)
        else raise(message, null)
      } finally {
        setBusy(false)
      }
    },
    [client, enter, raise, setFatalError],
  )

  useResumeStoredSeat({ client, enter, attach, setBusy })
  useKeepSessionFresh(connection, room)

  const leave = useCallback(() => {
    void connection?.leave()
    clearSession()
    setConnection(null)
  }, [connection, setConnection])
  const clearError = useCallback(() => { setRaised(null) }, [])

  const actions = useRoomActions({ connection, round, attach, raise, leave, setScreen, clearError })

  const scores = useMemo(() => (room === null ? {} : toScores(room)), [room])
  const events = snapshot?.events

  return {
    stage: connection !== null && room !== null ? 'room' : screen,
    state: room,
    round,
    playerId: connection?.playerId ?? null,
    results: events?.results ?? null,
    leaderboard: events?.leaderboard ?? null,
    closing: events?.closing ?? null,
    progress: snapshot?.progress ?? NO_PROGRESS,
    nextStage: events?.nextStage ?? null,
    finishAnimationEndsAtLocalMs: events?.finishAnimationEndsAtLocalMs ?? null,
    scores,
    error,
    busy,
    actions,
  }
}

/**
 * After a reload, take back the stored seat with its reconnection token. If
 * the server has already let it go, join the same room again as a new player.
 */
function useResumeStoredSeat(deps: {
  client: ReturnType<typeof useNetwork>['client']
  enter: (room: Room, name: string, avatar: string) => Promise<void>
  attach: (name: string, avatar: string, roomCode: string | null) => Promise<void>
  setBusy: (busy: boolean) => void
}): void {
  const { client, enter, attach, setBusy } = deps
  // StrictMode runs effects twice in development; a seat is claimed only once.
  const started = useRef(false)

  useEffect(() => {
    const session = readSession()
    if (started.current || session === null) return
    started.current = true

    client
      .reconnect(session.reconnectionToken)
      .then((room) => enter(room, session.name, session.avatar))
      .catch(() => attach(session.name, session.avatar, session.roomCode))
      .finally(() => { setBusy(false) })
  }, [client, enter, attach, setBusy])
}

/** The reconnection token can change after the SDK reconnects; keep the stored copy current. */
function useKeepSessionFresh(connection: PartyConnection | null, room: RoomView | null): void {
  useEffect(() => {
    if (connection === null || room === null) return
    const me = room.players.find((player) => player.playerId === connection.playerId)
    if (me === undefined) return
    writeSession({
      roomCode: room.roomCode,
      reconnectionToken: connection.room.reconnectionToken,
      name: me.name,
      avatar: me.avatar,
    })
  }, [connection, room])
}

function useRoomActions(deps: {
  connection: PartyConnection | null
  round: LiveRound
  attach: (name: string, avatar: string, roomCode: string | null) => Promise<void>
  raise: (message: string, against: RoomView | null) => void
  leave: () => void
  setScreen: (screen: Exclude<ArenaStage, 'room'>) => void
  clearError: () => void
}): RoomActions {
  const { connection, round, attach, raise, leave, setScreen, clearError } = deps
  const { roundId, attempt } = round

  return useMemo<RoomActions>(() => {
    /** Send a request; a refusal shows as a notice until the room next changes. */
    const run = (type: string, payload?: unknown) => {
      connection?.request(type, payload).catch((failure: unknown) => {
        raise(describeRequestError(failure), connection.getSnapshot().room)
      })
    }

    return {
      goToHost: () => { clearError(); setScreen('host') },
      goToJoin: () => { clearError(); setScreen('join') },
      goToTitle: () => { leave(); clearError(); setScreen('title') },
      host: (name, avatar) => { void attach(name, avatar, null) },
      join: (name, avatar, code) => { void attach(name, avatar, code) },

      setReady: (ready) => { run(ClientRequest.SetReady, { ready }) },
      start: () => { run(ClientRequest.StartCompetition) },
      setPlaylist: (mode, gameIds) => {
        run(ClientRequest.SetMode, gameIds ? { mode, gameIds } : { mode })
      },
      skip: () => { run(ClientRequest.SkipResults) },
      skipGame: () => { run(ClientRequest.SkipGame) },
      backToLobby: () => { run(ClientRequest.ReturnToLobby) },
      kick: (playerId) => { run(ClientRequest.KickPlayer, { playerId }) },

      readyForRound: () => { run(ClientRequest.ReadyForRound, { roundId, attempt }) },
      submitResult: (result) => { run(ClientRequest.SubmitResult, { roundId, attempt, result }) },
      sendAction: async (action) => {
        if (connection === null) throw new Error('Not in a room.')
        try {
          return await connection.request(ClientRequest.RoundAction, { roundId, attempt, action })
        } catch (failure) {
          throw new Error(describeRequestError(failure), { cause: failure })
        }
      },
      // Fire and forget: dropping one costs nothing.
      reportProgress: (progress) => {
        connection?.send(ClientMessage.Progress, { roundId, attempt, progress })
      },
    }
  }, [connection, roundId, attempt, attach, raise, leave, setScreen, clearError])
}
