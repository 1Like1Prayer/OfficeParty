import type { DIRECTIONS } from './constants.js';

export type Direction = (typeof DIRECTIONS)[number];

/** The arrow showing after `pressCount` presses. Endless: it never loops. */
export type ArrowSequence = (pressCount: number) => Direction;

/** Public round data. Everyone races in one group; last one standing wins. */
export interface CrusherEscalatorRound {
    /**
     * Each participant's arrow seed, by player id. Client and server both turn
     * it into the same endless sequence with `arrowSequence` (stream.ts). The
     * seeds differ per player, but nothing in them helps anyone else.
     */
    seeds: Record<string, number>;
}

/** One key press, timed by the client from when the race started. */
export interface Input {
    direction: Direction;
    atMs: number;
}

export interface CrusherEscalatorResult {
    /** Every press the player made, in order. The server judges them. */
    inputs: Input[];
    /** The tab was backgrounded mid-race, so local timing may be off. */
    timingSuspect: boolean;
}
