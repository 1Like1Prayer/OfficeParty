/**
 * The room as the UI renders it, built from the synced Colyseus state.
 *
 * The server's state is shaped for syncing (players keyed by id, '' for
 * "none"). The selectors and screens want something easier to render
 * (players in join order, null for "none"), so this one place converts.
 * Everything here is pure.
 */

import type { GameId } from '../shared/games/catalog.ts'
import type { PartyStateJson, PlayerStateJson, RoundStateJson } from '../shared/partyState.ts'
import type {
  PlaylistMode,
  RoomPhase,
  RoundPhase,
  StartBlockedReason,
} from '../shared/protocol.ts'
import type { PartyRoom } from './types.ts'

export interface PlayerView {
  playerId: string
  name: string
  /** Avatar seed the player picked. */
  avatar: string
  connected: boolean
  isOwner: boolean
  /** Joined after the competition started, so they watch rather than play. */
  isSpectator: boolean
  /** Pressed ready in the lobby. The owner is always ready. */
  ready: boolean
  points: number
}

export interface LobbyView {
  /** Connected players who are ready. Always includes the owner. */
  ready: string[]
  /** Connected players the room is still waiting on. */
  waitingFor: string[]
  allReady: boolean
  /** True when the owner can press start right now. */
  canStart: boolean
  /** Why start is unavailable, or null when it is available. */
  blockedReason: StartBlockedReason | null
  /** How many scoring rounds each playable game is played for. */
  roundsByGame: Partial<Record<GameId, number>>
  /** The set list the owner picks from: games that are actually built. */
  playableGames: GameId[]
}

export interface RoundView {
  phase: RoundPhase
  roundId: number
  attempt: number
  gameId: GameId | null
  /** Which game of the playlist (1-based), and which of its rounds. */
  gameIndex: number
  totalGames: number
  roundInGame: number
  roundsPerGame: number
  isTiebreak: boolean
  participants: string[]
  ready: string[]
  waitingFor: string[]
  /** Room-timeline time the countdown begins, once scheduled. */
  startAtServerMs: number | null
}

export interface RoomView {
  roomCode: string
  phase: RoomPhase
  ownerId: string
  /** In join order. */
  players: PlayerView[]
  mode: PlaylistMode
  /** The competition's playlist, or the owner's custom picks in the lobby. */
  playlist: GameId[]
  lobby: LobbyView
  round: RoundView
  minPlayers: number
  maxPlayers: number
}

/** Live per-player progress for the running round, keyed by player id. */
export type ProgressByPlayer = Record<string, Record<string, number>>

/** The synced state as plain JSON. Cheap at this size, and simple to reason about. */
export function readPartyState(room: PartyRoom): PartyStateJson {
  return (room.state as { toJSON(): unknown }).toJSON() as PartyStateJson
}

const toPlayerView = (player: PlayerStateJson): PlayerView => ({
  playerId: player.id,
  name: player.name,
  avatar: player.avatar,
  connected: player.connected,
  isOwner: player.isOwner,
  isSpectator: player.isSpectator,
  ready: player.ready,
  points: player.points,
})

const toRoundView = (round: RoundStateJson): RoundView => ({
  phase: round.phase,
  roundId: round.roundId,
  attempt: round.attempt,
  gameId: round.gameId === '' ? null : round.gameId,
  gameIndex: round.gameIndex,
  totalGames: round.totalGames,
  roundInGame: round.roundInGame,
  roundsPerGame: round.roundsPerGame,
  isTiebreak: round.isTiebreak,
  participants: round.participants,
  ready: round.ready,
  waitingFor: round.waitingFor,
  startAtServerMs: round.startAtMs ?? null,
})

export function toRoomView(state: PartyStateJson): RoomView {
  const players = Object.values(state.players)
    .sort((a, b) => a.joinOrder - b.joinOrder)
    .map(toPlayerView)
  const active = players.filter((player) => player.connected && !player.isSpectator)
  const { lobby } = state

  return {
    roomCode: state.roomCode,
    phase: state.phase,
    ownerId: state.ownerId,
    players,
    mode: lobby.mode,
    playlist: state.phase === 'lobby' ? lobby.customPlaylist : state.playlist,
    lobby: {
      ready: active.filter((player) => player.ready).map((player) => player.playerId),
      waitingFor: lobby.waitingFor,
      allReady: active.length > 0 && lobby.waitingFor.length === 0,
      canStart: lobby.canStart,
      blockedReason: lobby.blockedReason === '' ? null : lobby.blockedReason,
      roundsByGame: lobby.roundsByGame,
      playableGames: lobby.playableGames,
    },
    round: toRoundView(state.round),
    minPlayers: state.minPlayers,
    maxPlayers: state.maxPlayers,
  }
}

export function toProgressByPlayer(state: PartyStateJson): ProgressByPlayer {
  return Object.fromEntries(
    Object.entries(state.round.progress).map(([playerId, entry]) => [playerId, entry.values]),
  )
}

/** Points per player, for the scoreboard. */
export function toScores(room: RoomView): Record<string, number> {
  return Object.fromEntries(room.players.map((player) => [player.playerId, player.points]))
}
