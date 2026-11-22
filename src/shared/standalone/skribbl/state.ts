/**
 * The Skribbl room's synced state as plain JSON (`room.state.toJSON()`).
 * Mirrors `server/rooms/skribbl/schema/` without importing Colyseus;
 * `test/skribbl/stateShape.test.ts` fails if the two drift apart.
 *
 * Nothing here is secret: the word is never in state, only its pattern.
 * Times are on the room timeline; convert them with ClockSync.
 */

import type { PlayerStateJson } from '../../partyState.js';
import type { SkribblPhase, SkribblSettings, TurnPhase } from './protocol.js';

/** `points` is the player's score in the current (or last) game. */
export type SkribblPlayerJson = PlayerStateJson;

export interface TurnStateJson {
    phase: TurnPhase;
    /** Increments every turn. Draw packets and requests carry it. */
    turnId: number;
    /** 1-based round; every player draws once per round. */
    round: number;
    totalRounds: number;
    drawerId: string;
    /** When the current turn phase ends; 0 when nothing is timed. */
    endsAtMs: number;
    /** The turn's full drawing time, for a timer bar. */
    drawTimeMs: number;
    /** '_' for each hidden letter, e.g. "_-___" for "T-rex"; the whole word once revealed. */
    wordPattern: string;
    /** Players who guessed this turn, in the order they did. */
    guessed: string[];
}

export interface SkribblStateJson {
    roomCode: string;
    phase: SkribblPhase;
    ownerId: string;
    players: Record<string, SkribblPlayerJson>;
    settings: SkribblSettings;
    canStart: boolean;
    /** 'not_enough_players', or '' when the owner can start. */
    blockedReason: 'not_enough_players' | '';
    minPlayers: number;
    maxPlayers: number;
    turn: TurnStateJson;
}
