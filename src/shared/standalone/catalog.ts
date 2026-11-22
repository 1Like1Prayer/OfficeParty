/**
 * The standalone games: games played on their own, outside the party
 * competition, each in its own room. The platform's "Standalone games" tab
 * lists these; picking one creates that game's room (joined by a 4-character
 * code, exactly like a party room).
 */

export const STANDALONE_GAME_IDS = ['skribbl'] as const;

export type StandaloneGameId = (typeof STANDALONE_GAME_IDS)[number];

export interface StandaloneGameMeta {
    id: StandaloneGameId;
    title: string;
    description: string;
    /** The Colyseus room name to `client.create(...)`. */
    roomName: string;
    minPlayers: number;
    maxPlayers: number;
    implemented: boolean;
}

export const STANDALONE_CATALOG: Record<StandaloneGameId, StandaloneGameMeta> = {
    skribbl: {
        id: 'skribbl',
        title: 'Skribbl',
        description: 'Take turns drawing a word while everyone else races to guess it.',
        roomName: 'skribbl',
        minPlayers: 2,
        maxPlayers: 12,
        implemented: true
    }
};

export const isStandaloneGameId = (value: unknown): value is StandaloneGameId =>
    typeof value === 'string' && (STANDALONE_GAME_IDS as readonly string[]).includes(value);
