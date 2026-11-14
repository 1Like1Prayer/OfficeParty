/**
 * Arrow sequences.
 *
 * Each player gets a seed; the seed expands into an endless sequence of
 * directions that advances on every key press (right or wrong). The client
 * and the server run the same code on the same seed, so they always agree on
 * which arrow was showing. Rules:
 *  - never the same direction twice in a row;
 *  - every player gets a different seed, so a different sequence;
 *  - it never loops, so there is no pattern to memorise.
 */

import { randomInt, seededRandom, type RandomSource } from '../random.js';
import { DIRECTIONS } from './constants.js';
import type { ArrowSequence, Direction } from './types.js';

/** Any direction except `previous`. Always possible: there are four. */
const pickDirectionAfter = (random: RandomSource, previous: Direction | undefined): Direction => {
    const allowed = DIRECTIONS.filter((direction) => direction !== previous);
    return allowed[randomInt(random, 0, allowed.length - 1)]!;
};

/**
 * The sequence a seed describes. Arrows are generated as they are first asked
 * for and remembered, so looking any of them up again is free.
 */
export const arrowSequence = (seed: number): ArrowSequence => {
    const random = seededRandom(seed);
    const shown: Direction[] = [];

    return (pressCount) => {
        while (shown.length <= pressCount) shown.push(pickDirectionAfter(random, shown.at(-1)));
        return shown[pressCount]!;
    };
};

/** Seeds are unsigned 32-bit numbers, which mulberry32 uses in full. */
const MAX_SEED = 0xffff_ffff;

/** One seed per player, no two alike. */
export const generatePlayerSeeds = (
    playerIds: readonly string[],
    random: RandomSource = Math.random
): Record<string, number> => {
    const seeds: Record<string, number> = {};
    const used = new Set<number>();

    for (const playerId of playerIds) {
        let seed = randomInt(random, 0, MAX_SEED);
        while (used.has(seed)) seed = randomInt(random, 0, MAX_SEED);

        used.add(seed);
        seeds[playerId] = seed;
    }
    return seeds;
};
