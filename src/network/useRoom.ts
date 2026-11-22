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
  type LaunchStandaloneReply,
  type LeaderboardPayload,
  type PlaylistMode,
  type RoundClosingPayload,
  type RoundResultsPayload,
} from '../shared/protocol.ts'
import type { StandaloneGameId } from '../shared/standalone/catalog.ts'
import type { NextStageView } from '../types/index.ts'
import { describeJoinError, describeRequestError } from './errors.ts'
import { PartyConnection } from './partyConnection.ts'
import { toScores, type ProgressByPlayer, type RoomView, type SharedValues } from './roomView.ts'
import {
  clearGameSession,
  clearSession,
  readGameSession,
  readSession,
  writeGameSession,
  writeSession,
} from './session.ts'
import { SkribblConnection } from './skribblConnection.ts'
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

  /* Standalone games */
  /** Owner only: open a standalone game; everyone in the lobby moves into it. */
  launchStandalone: (gameId: StandaloneGameId) => void
  /** Join the standalone game the room has open (for a latecomer, or after leaving it). */
  joinStandalone: () => void
  /** Leave the standalone game and go back to the party lobby. */
  leaveStandalone: () => void

  /* Round */
  /** Acknowledge the ready check for the round on screen. */
  /** Ready for the round, or (false) take it back, until the start's lead runs out. */
  readyForRound: (ready?: boolean) => void
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
  /** The running round's shared world, as the server owns it. */
  shared: SharedValues
  /** Set while a round goes on to another stage (heats -> final). */
  nextStage: NextStageView | null
  /** `performance.now()` value the game's ending animation runs until, if any. */
  finishAnimationEndsAtLocalMs: number | null
  /** Points per player. */
  scores: Record<string, number>
  error: string | null
  /** A create, join or rejoin is in flight. */
  busy: boolean
  /** The standalone game this tab is playing, or null. */
  game: SkribblConnection | null
  actions: RoomActions
}

/** An error belongs to the room view it was raised against; any change clears it. */
interface RaisedError {
  message: string
  against: RoomView | null
}

const NO_PROGRESS: ProgressByPlayer = {}
const NO_SHARED: SharedValues = {}

/**
 * Everything this tab knows about the room it is in. One tab is one player.
 *
 * The server is authoritative throughout: every action is an intent, and the
 * UI renders only what comes back in the synced state and the round messages.
 */
export function useRoom(): UseRoomResult {
  const { client, connection, setConnection, game, setGame, setFatalError } = useNetwork()
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
        raise(code === KICKED_CODE ? 'The Admin has kicked you from the room.' : 'The room has closed.', null)
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

  /* ---------------------------- standalone games ---------------------------- */

  /** Seat this tab in a standalone game's room, opened from party `partyCode`. */
  const enterGame = useCallback(
    async (joined: Room, partyCode: string) => {
      const next = await SkribblConnection.open(joined, (code) => {
        clearGameSession()
        setGame(null)
        raise(code === KICKED_CODE ? 'The Admin removed you from the game.' : 'The game has closed.', null)
      })
      writeGameSession({ partyCode, roomCode: joined.roomId, reconnectionToken: joined.reconnectionToken })
      setGame(next)
    },
    [setGame, raise],
  )

  // One join at a time: the auto-join and a click must not take two seats.
  const gameJoining = useRef(false)
  const joinGame = useCallback(
    async (roomCode: string, ownerToken?: string) => {
      if (connection === null || gameJoining.current) return
      const party = connection.getSnapshot().room
      const me = party.players.find((player) => player.playerId === connection.playerId)
      gameJoining.current = true
      try {
        const options: JoinOptions = {
          protocolVersion: PROTOCOL_VERSION,
          name: me?.name,
          avatar: me?.avatar,
          ...(ownerToken === undefined ? {} : { ownerToken }),
        }
        const joined = await client.joinById(roomCode, options)
        await enterGame(joined, party.roomCode)
      } catch (failure) {
        raise(describeJoinError(failure).message, connection.getSnapshot().room)
      } finally {
        gameJoining.current = false
      }
    },
    [client, connection, enterGame, raise],
  )

  const leaveGame = useCallback(() => {
    void game?.leave()
    clearGameSession()
    setGame(null)
  }, [game, setGame])

  // No game without its party: leaving or losing the party room leaves the game too.
  useEffect(() => {
    if (connection === null && game !== null) leaveGame()
  }, [connection, game, leaveGame])

  const launching = useRef(false)
  const seenStandalone = useFollowStandalone({ room, connection, game, launching, joinGame })

  const launchGame = useCallback(
    (gameId: StandaloneGameId) => {
      if (connection === null || launching.current) return
      launching.current = true
      connection
        .request<LaunchStandaloneReply>(ClientRequest.LaunchStandalone, { gameId })
        .then((reply) => {
          seenStandalone.current = reply.roomCode
          return joinGame(reply.roomCode, reply.ownerToken)
        })
        .catch((failure: unknown) => { raise(describeRequestError(failure), connection.getSnapshot().room) })
        .finally(() => { launching.current = false })
    },
    [connection, joinGame, raise, seenStandalone],
  )

  useResumeStoredSeat({ client, enter, attach, enterGame, setBusy })
  useKeepSessionFresh(connection, room)

  const leave = useCallback(() => {
    void connection?.leave()
    clearSession()
    setConnection(null)
  }, [connection, setConnection])
  const clearError = useCallback(() => { setRaised(null) }, [])

  const roomActions = useRoomActions({ connection, round, attach, raise, leave, setScreen, clearError })
  const standaloneCode = room?.standalone?.roomCode ?? null
  const actions = useMemo<RoomActions>(
    () => ({
      ...roomActions,
      launchStandalone: launchGame,
      joinStandalone: () => { if (standaloneCode !== null) void joinGame(standaloneCode) },
      leaveStandalone: leaveGame,
    }),
    [roomActions, launchGame, joinGame, leaveGame, standaloneCode],
  )

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
    shared: snapshot?.shared ?? NO_SHARED,
    nextStage: events?.nextStage ?? null,
    finishAnimationEndsAtLocalMs: events?.finishAnimationEndsAtLocalMs ?? null,
    scores,
    error,
    busy,
    game,
    actions,
  }
}

/**
 * Follow the room into a standalone game the owner opens: when a new one
 * appears while this tab is in the lobby, join it. One that was already open
 * when this tab arrived is only offered, never joined by itself, and neither
 * is one this tab just left. Returns the last code seen, which a launch sets
 * so its own game isn't joined twice.
 */
function useFollowStandalone(deps: {
  room: RoomView | null
  connection: PartyConnection | null
  game: SkribblConnection | null
  launching: { current: boolean }
  joinGame: (roomCode: string) => Promise<void>
}): { current: string | null | undefined } {
  const { room, connection, game, launching, joinGame } = deps
  const code = room?.standalone?.roomCode ?? null
  /** undefined until this connection's first state: what was open on arrival isn't news. */
  const seen = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (connection === null) {
      seen.current = undefined
      return
    }
    if (seen.current === undefined) {
      seen.current = code
      return
    }
    if (code === seen.current) return
    seen.current = code
    // The owner joins with their token once the launch answers.
    if (code !== null && game === null && !launching.current) void joinGame(code)
  }, [connection, code, game, launching, joinGame])

  return seen
}

/**
 * After a reload, take back the stored seat with its reconnection token. If
 * the server has already let it go, join the same room again as a new player.
 */
function useResumeStoredSeat(deps: {
  client: ReturnType<typeof useNetwork>['client']
  enter: (room: Room, name: string, avatar: string) => Promise<void>
  attach: (name: string, avatar: string, roomCode: string | null) => Promise<void>
  enterGame: (room: Room, partyCode: string) => Promise<void>
  setBusy: (busy: boolean) => void
}): void {
  const { client, enter, attach, enterGame, setBusy } = deps
  // StrictMode runs effects twice in development; a seat is claimed only once.
  const started = useRef(false)

  useEffect(() => {
    const session = readSession()
    if (started.current || session === null) return
    started.current = true

    // The standalone game this tab was playing, if it was opened from this party.
    const gameSession = readGameSession()
    const resumeGame = async () => {
      if (gameSession === null) return
      if (gameSession.partyCode !== session.roomCode) {
        clearGameSession()
        return
      }
      try {
        await enterGame(await client.reconnect(gameSession.reconnectionToken), gameSession.partyCode)
      } catch {
        // The seat is gone; the lobby offers the game again if it's still open.
        clearGameSession()
      }
    }

    client
      .reconnect(session.reconnectionToken)
      .then((room) => enter(room, session.name, session.avatar))
      .catch(() => attach(session.name, session.avatar, session.roomCode))
      .then(resumeGame)
      .finally(() => { setBusy(false) })
  }, [client, enter, attach, enterGame, setBusy])
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

type PartyRoomActions = Omit<RoomActions, 'launchStandalone' | 'joinStandalone' | 'leaveStandalone'>

function useRoomActions(deps: {
  connection: PartyConnection | null
  round: LiveRound
  attach: (name: string, avatar: string, roomCode: string | null) => Promise<void>
  raise: (message: string, against: RoomView | null) => void
  leave: () => void
  setScreen: (screen: Exclude<ArenaStage, 'room'>) => void
  clearError: () => void
}): PartyRoomActions {
  const { connection, round, attach, raise, leave, setScreen, clearError } = deps
  const { roundId, attempt } = round

  return useMemo<PartyRoomActions>(() => {
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

      readyForRound: (ready = true) => { run(ClientRequest.ReadyForRound, { roundId, attempt, ready }) },
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
