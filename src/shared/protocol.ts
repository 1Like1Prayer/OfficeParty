/**
 * The wire protocol. Both sides import this file, so a message shape can
 * only change in one place.
 *
 * The protocol uses a hybrid split (netcode guide: "snapshots for what's true,
 * events for what happened"):
 *
 * - **State** (Colyseus schema, delta-synced, resynced on reconnect): players,
 *   owner, lobby, playlist, scores, the round lifecycle and live progress.
 *   See `server/rooms/party/schema/`.
 * - **Reliable messages** (one-off events): round data, results, closing
 *   notices, the leaderboard. Payload types are below.
 * - **Requests** (`room.request`, the reply is the return value): every client
 *   action that needs an answer. A refused request rejects with an Error
 *   whose `reason` is a `RequestError`.
 *
 * Round-scoped messages carry `roundId` (increments each scoring round) and
 * `attempt` (which stage or tiebreaker within it), so a late message from a
 * round the room has moved past is thrown away instead of confusing the
 * current one.
 */

import type { GameId } from './games/catalog.js';
import type { RankedEntry } from './games/selfTimed.js';

/** The Colyseus room name clients create and join. */
export const PARTY_ROOM_NAME = 'party';

/** Close code for a client running an outdated build. It should reload. */
export const PROTOCOL_MISMATCH_CODE = 4100;

/** Close code for a player the room owner removed. The client should not rejoin by itself. */
export const KICKED_CODE = 4102;

/* ------------------------------------------------------------------ */
/* Message names                                                        */
/* ------------------------------------------------------------------ */

/** Client -> server, answered: send with `room.request(type, payload)`. */
export const ClientRequest = {
    SetName: 'room:setName',
    SetMode: 'lobby:setMode',
    SetReady: 'lobby:ready',
    StartCompetition: 'lobby:start',
    SkipResults: 'competition:skip',
    /** Owner: abandon the current game and go to the next (or the final leaderboard). */
    SkipGame: 'competition:skipGame',
    /** Owner: end the competition and take everyone back to the lobby. */
    ReturnToLobby: 'competition:toLobby',
    /** Owner: remove a player from the room. */
    KickPlayer: 'room:kick',
    ReadyForRound: 'round:ready',
    SubmitResult: 'round:result',
    /** A mid-round request the game answers (e.g. casting the dice). */
    RoundAction: 'round:action',
    Ping: 'time:ping'
} as const;

/** Client -> server, fire and forget: send with `room.send(type, payload)`. */
export const ClientMessage = {
    /** Display-only, ~5 Hz. Dropping one costs nothing. */
    Progress: 'round:progress'
} as const;

/** Server -> client, reliable and ordered. */
export const ServerMessage = {
    GameStarting: 'competition:gameStarting',
    RoundData: 'round:data',
    RoundClosing: 'round:closing',
    RoundResults: 'round:results',
    Leaderboard: 'competition:leaderboard'
} as const;

/* ------------------------------------------------------------------ */
/* Joining and replies                                                  */
/* ------------------------------------------------------------------ */

/** Options for `client.create(PARTY_ROOM_NAME, …)` and `client.joinById(code, …)`. */
export interface JoinOptions {
    protocolVersion: number;
    name?: string;
    /** Avatar seed. See AVATAR in constants. */
    avatar?: string;
}

export type ErrorCode =
    | 'not_owner'
    | 'not_in_room'
    | 'not_enough_players'
    | 'players_not_ready'
    | 'invalid_playlist'
    | 'invalid_payload'
    | 'wrong_phase'
    | 'stale_round'
    | 'duplicate_result'
    | 'competition_in_progress'
    | 'invalid_target';

/** A refused request's reason: the rejected Error's `reason` property on the client. */
export interface RequestError {
    code: ErrorCode;
    message: string;
}

/*
 * Reply types. Colyseus's `validate()` types a validated handler's reply as
 * void on the client, so the replies are spelled out here.
 */
export interface SetNameReply {
    name: string;
}

export interface SetModeReply {
    mode: PlaylistMode;
    playlist: GameId[];
}

export interface SetReadyReply {
    ready: boolean;
}

export interface StartCompetitionReply {
    playlist: GameId[];
}

export interface PingReply {
    /** Room timeline: monotonic milliseconds since the room was created. */
    serverTimeMs: number;
}

/* ------------------------------------------------------------------ */
/* Phases (mirrored in the schema state as strings)                     */
/* ------------------------------------------------------------------ */

export type RoomPhase = 'lobby' | 'competition' | 'leaderboard';

/**
 * The round's own lifecycle: Loading -> ReadyCheck -> Start -> Playing -> Results.
 *
 * `countdown` is the 3, 2, 1 the client shows between the scheduled start and
 * the clock running. Nothing is timed during it and results are not accepted.
 */
export type RoundPhase =
    | 'idle'
    | 'loading'
    | 'ready-check'
    | 'starting'
    | 'countdown'
    | 'playing'
    | 'results';

export type PlaylistMode = 'random' | 'custom';

export type StartBlockedReason =
    | 'not_enough_players'
    | 'players_not_ready'
    | 'invalid_playlist';

/* ------------------------------------------------------------------ */
/* Request payloads                                                     */
/* ------------------------------------------------------------------ */

export interface RoundEnvelope {
    roundId: number;
    attempt: number;
}

export interface SetNameRequest {
    name: string;
}

export interface SetModeRequest {
    mode: PlaylistMode;
    gameIds?: GameId[];
}

export interface SetReadyRequest {
    ready: boolean;
}

export interface KickPlayerRequest {
    playerId: string;
}

export interface SubmitResultRequest extends RoundEnvelope {
    /** Game-specific; validated by the game module. */
    result: unknown;
}

export interface RoundActionRequest extends RoundEnvelope {
    /** Game-specific; validated by the game module. */
    action: unknown;
}

export interface ProgressMessage extends RoundEnvelope {
    /** Game-specific; validated by the game module. */
    progress: unknown;
}

/* ------------------------------------------------------------------ */
/* Server message payloads                                              */
/* ------------------------------------------------------------------ */

export interface GameStartingPayload extends RoundEnvelope {
    gameId: GameId;
    title: string;
    gameIndex: number;
    totalGames: number;
    roundInGame: number;
    /** How many scoring rounds this game has in total. */
    roundsPerGame: number;
}

export interface RoundDataPayload<TRound = unknown> extends RoundEnvelope {
    gameId: GameId;
    /** Public round data only: it must contain nothing a player shouldn't see. */
    data: TRound;
    isTiebreak: boolean;
    participants: string[];
    resultTimeoutMs: number;
}

/**
 * Sent when the round has been decided as far as the server can tell, and the
 * players listed in `pending` are still playing: they must stop and send the
 * result they have now. It decides nothing by itself; the server still replays
 * every result before naming a winner.
 */
export interface RoundClosingPayload extends RoundEnvelope {
    pending: string[];
    /** After this long the server stops waiting for them and scores without them. */
    graceMs: number;
}

export interface ScoreRow {
    playerId: string;
    points: number;
}

export interface RoundResultsPayload extends RoundEnvelope {
    gameId: GameId;
    /** Revealed together, once everyone is in or the timeout has expired. */
    ranked: RankedEntry[];
    /** Players who never reported. They rank last and score nothing. */
    noShow: string[];
    winnerId: string | null;
    /** A tie survived every tiebreaker and the winner was drawn at random. */
    decidedByCoinFlip: boolean;
    /** True on the last attempt of the scoring round, i.e. a point was awarded. */
    isFinal: boolean;
    scores: ScoreRow[];
    /**
     * Set when the round goes on to another stage (e.g. heats -> final): the
     * players who advance. Null when the round is finished or a tiebreaker follows.
     */
    advancing: string[] | null;
    /** The pause before the next stage loads. Zero when there is no next stage. */
    stageBreakMs: number;
    /**
     * Milliseconds clients have to play the ending animation before the
     * results screen's own display time starts. Always zero when `isFinal` is
     * false: a tiebreaker or a stage break is not an ending.
     */
    finishAnimationMs: number;
    /** Room-timeline time the next round loads, when one is scheduled. */
    nextRoundAtServerMs: number | null;
}

export interface LeaderboardRow extends ScoreRow {
    rank: number;
}

export interface LeaderboardPayload {
    rows: LeaderboardRow[];
    /** Tied final scores are left tied; there is no overall tiebreaker. */
    tied: boolean;
}
