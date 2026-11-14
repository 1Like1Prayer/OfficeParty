/**
 * The party room's synced state, as plain JSON (what `room.state.toJSON()`
 * returns on the client).
 *
 * The schema classes in `server/rooms/party/schema/` are the source of truth;
 * this mirrors them without importing Colyseus, so the browser can type the
 * state it renders. `test/partyStateShape.test.ts` fails the build if the two
 * drift apart.
 *
 * All times are on the room timeline (milliseconds since the room was
 * created); convert them with ClockSync.
 */

import type { GameId } from './games/catalog.js';
import type { PlaylistMode, RoomPhase, RoundPhase, StartBlockedReason } from './protocol.js';

export interface PlayerStateJson {
    id: string;
    name: string;
    avatar: string;
    connected: boolean;
    isOwner: boolean;
    isSpectator: boolean;
    ready: boolean;
    points: number;
    joinOrder: number;
}

export interface LobbyStateJson {
    mode: PlaylistMode;
    customPlaylist: GameId[];
    playableGames: GameId[];
    roundsByGame: Partial<Record<GameId, number>>;
    waitingFor: string[];
    canStart: boolean;
    /** '' when start is available. */
    blockedReason: StartBlockedReason | '';
}

export interface RoundStateJson {
    phase: RoundPhase;
    roundId: number;
    attempt: number;
    /** '' before the first round. */
    gameId: GameId | '';
    gameIndex: number;
    totalGames: number;
    roundInGame: number;
    roundsPerGame: number;
    isTiebreak: boolean;
    participants: string[];
    ready: string[];
    waitingFor: string[];
    readyDeadlineMs: number;
    startAtMs?: number;
    countdownMs: number;
    timingStartsAtMs?: number;
    resultTimeoutMs: number;
    /** Latest display-only progress per player. Keys are the game's own. */
    progress: Record<string, { values: Record<string, number> }>;
}

export interface PartyStateJson {
    roomCode: string;
    phase: RoomPhase;
    ownerId: string;
    players: Record<string, PlayerStateJson>;
    lobby: LobbyStateJson;
    playlist: GameId[];
    totalRounds: number;
    round: RoundStateJson;
    minPlayers: number;
    maxPlayers: number;
}
