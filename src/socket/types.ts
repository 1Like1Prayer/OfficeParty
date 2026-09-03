import type { Socket } from 'socket.io-client'
import type {
  Ack,
  ErrorPayload,
  GameStartingPayload,
  JoinAckData,
  LeaderboardPayload,
  PingAckData,
  PlaylistPayload,
  ProgressPayload,
  ReadyStatePayload,
  RoomStatePayload,
  RoundDataPayload,
  RoundResultsPayload,
  ScoreRow,
  StartAtPayload,
} from '../shared/protocol.ts'
import type { GameId } from '../shared/games/catalog.ts'

/**
 * The socket.io event map, written from `shared/protocol.ts`. Acks are the
 * server's only reply channel for intents, so every client event that takes
 * one is typed with it.
 */
export interface ServerToClientEvents {
  'room:state': (state: RoomStatePayload) => void
  'room:playerJoined': (payload: { playerId: string; name: string }) => void
  'room:playerLeft': (payload: { playerId: string; name: string }) => void
  'room:playerReconnected': (payload: { playerId: string; name: string }) => void
  'room:ownerChanged': (payload: { ownerId: string }) => void
  'room:closed': (payload: { roomCode: string }) => void
  'competition:playlist': (payload: PlaylistPayload) => void
  'competition:gameStarting': (payload: GameStartingPayload) => void
  'competition:scores': (payload: { scores: ScoreRow[] }) => void
  'competition:leaderboard': (payload: LeaderboardPayload) => void
  'round:data': (payload: RoundDataPayload) => void
  'round:readyState': (payload: ReadyStatePayload) => void
  'round:startAt': (payload: StartAtPayload) => void
  'round:progress': (payload: ProgressPayload) => void
  'round:results': (payload: RoundResultsPayload) => void
  'protocol:mismatch': (payload: { expected: number; received: number | null }) => void
  error: (payload: ErrorPayload) => void
}

export interface ClientToServerEvents {
  'room:create': (
    payload: { name?: string },
    ack: (response: Ack<JoinAckData>) => void,
  ) => void
  'room:join': (
    payload: { roomCode: string; name?: string; playerId?: string },
    ack: (response: Ack<JoinAckData>) => void,
  ) => void
  'room:leave': (payload: null, ack: (response: Ack<null>) => void) => void
  'room:setName': (
    payload: { name: string },
    ack: (response: Ack<unknown>) => void,
  ) => void
  'room:requestState': (
    payload: null,
    ack: (response: Ack<RoomStatePayload>) => void,
  ) => void
  'lobby:setMode': (
    payload: { mode: 'random' | 'custom'; gameIds?: GameId[] },
    ack: (response: Ack<unknown>) => void,
  ) => void
  'lobby:setRounds': (
    payload: { roundsPerGame: number },
    ack: (response: Ack<unknown>) => void,
  ) => void
  'lobby:ready': (
    payload: { ready: boolean },
    ack: (response: Ack<unknown>) => void,
  ) => void
  'lobby:start': (payload: null, ack: (response: Ack<unknown>) => void) => void
  'competition:skip': (payload: null, ack: (response: Ack<null>) => void) => void
  'round:ready': (
    payload: { roundId: number; attempt: number },
    ack: (response: Ack<null>) => void,
  ) => void
  'round:result': (
    payload: { roundId: number; attempt: number; result: unknown },
    ack: (response: Ack<null>) => void,
  ) => void
  'round:progress': (payload: {
    roundId: number
    attempt: number
    progress: unknown
  }) => void
  'time:ping': (payload: null, ack: (response: Ack<PingAckData>) => void) => void
}

export type ArenaSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

/** This tab's slot in the room it is playing. */
export interface ArenaSession {
  roomCode: string
  playerId: string
  name: string
}
