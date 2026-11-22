/**
 * The Skribbl room's wire protocol. Same split as the party room:
 *
 * - **State** (delta-synced, resynced on reconnect): players and scores,
 *   settings, the turn (who draws, the phase, its deadline, the word's public
 *   pattern, who has guessed). See `state.ts`.
 * - **Reliable messages**: one-off events, some private (the word choices
 *   and the word itself only ever go to players allowed to see them).
 * - **Requests** (`room.request`): actions that need an answer. A refusal
 *   rejects with a `RequestError` (shared/protocol.ts).
 * - **Bytes** (`room.sendBytes` / `onMessage` with a Uint8Array): the
 *   drawing, in the binary format in `canvas.ts`.
 *
 * Joining, renaming, kicking and clock pings are the same as in the party
 * room: `client.create(SKRIBBL_ROOM_NAME, { protocolVersion, name, avatar })`,
 * `joinById(code, …)`, and `ClientRequest.SetName`, `KickPlayer`, `Ping`.
 */

import type { LeaderboardRow, ScoreRow } from '../../protocol.js';

export const SKRIBBL_ROOM_NAME = 'skribbl';

/** Client -> server, answered: `room.request(type, payload)`. */
export const SkribblRequest = {
    /** Owner, in the lobby. */
    UpdateSettings: 'skribbl:settings',
    /** Owner, in the lobby. */
    Start: 'skribbl:start',
    /** The drawer picks one of the offered words. */
    ChooseWord: 'skribbl:choose',
    /** A chat line. While someone draws, a guesser's line is their guess. */
    Say: 'skribbl:say',
    /** Owner: stop the game and take everyone back to the lobby. */
    ReturnToLobby: 'skribbl:toLobby'
} as const;

/**
 * Binary messages. The drawer sends `Draw` with `room.sendBytes`; everyone
 * else receives the same bytes under the same name. `Canvas` is the whole
 * drawing so far, sent privately to a player who joins or reconnects
 * mid-turn: draw it at once, without the playout delay.
 */
export const SkribblBytes = {
    Draw: 'skribbl:draw',
    Canvas: 'skribbl:canvas'
} as const;

/** Server -> client, reliable and ordered. */
export const SkribblMessage = {
    /** Private, to the drawer. */
    WordChoices: 'skribbl:wordChoices',
    /** Private: to the drawer once chosen, and to each guesser once they guess it. */
    Word: 'skribbl:word',
    Chat: 'skribbl:chat',
    TurnEnded: 'skribbl:turnEnded',
    GameEnded: 'skribbl:gameEnded'
} as const;

/* ------------------------------------------------------------------ */
/* Phases (mirrored in state as strings)                                */
/* ------------------------------------------------------------------ */

export type SkribblPhase = 'lobby' | 'playing' | 'podium';

/** `choosing`: the drawer picks a word. `drawing`: everyone else guesses. `reveal`: the word and points show. */
export type TurnPhase = 'idle' | 'choosing' | 'drawing' | 'reveal';

/* ------------------------------------------------------------------ */
/* Requests and replies                                                 */
/* ------------------------------------------------------------------ */

export interface SkribblSettings {
    rounds: number;
    drawTimeSec: number;
    wordChoices: number;
    hints: number;
}

/** Only the fields given change. The reply is the full settings. */
export type UpdateSettingsRequest = Partial<SkribblSettings>;

export interface ChooseWordRequest {
    turnId: number;
    /** Index into the offered words. */
    index: number;
}

export interface ChooseWordReply {
    word: string;
}

export interface SayRequest {
    text: string;
}

/**
 * `correct`: it was the word (it is not shown to anyone). `close`: one letter
 * off; tell the player (the line is shown like any wrong guess). `sent`: an
 * ordinary chat line.
 */
export interface SayReply {
    verdict: 'correct' | 'close' | 'sent';
}

/* ------------------------------------------------------------------ */
/* Server messages                                                      */
/* ------------------------------------------------------------------ */

export interface WordChoicesPayload {
    turnId: number;
    words: string[];
    /** Room timeline: when a word is picked for the drawer. */
    endsAtServerMs: number;
}

export interface WordPayload {
    turnId: number;
    word: string;
}

/**
 * `all`: everyone sees it. `guessed`: only the drawer and the players who
 * have guessed this turn see it, so they can talk without giving it away.
 */
export type ChatChannel = 'all' | 'guessed';

export type ChatPayload =
    | { kind: 'message'; playerId: string; text: string; channel: ChatChannel }
    | { kind: 'guessed'; playerId: string; points: number };

export type TurnEndReason = 'time' | 'all-guessed' | 'drawer-left';

export interface TurnEndedPayload {
    turnId: number;
    /** Null when the drawer left before choosing one. */
    word: string | null;
    reason: TurnEndReason;
    /** What every player in the room scored this turn, best first (the drawer included). */
    points: ScoreRow[];
    /** Room timeline: when the next turn (or the podium) starts. */
    nextAtServerMs: number;
}

export type GameEndReason = 'finished' | 'not_enough_players';

export interface GameEndedPayload {
    reason: GameEndReason;
    rows: LeaderboardRow[];
    /** Room timeline: when the room returns to the lobby. */
    lobbyAtServerMs: number;
}
