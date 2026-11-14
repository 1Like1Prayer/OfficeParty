/**
 * The elimination gap over the course of a race. Shared, so the client can
 * show the current gap and crush itself at the same moment the server would.
 */

import { CRUSHER_ESCALATOR } from './constants.js';

const {
    ELIMINATION_GAP_START: START,
    ELIMINATION_GAP_MIN: MIN,
    GAP_SHRINK_STARTS_MS: STARTS_MS,
    GAP_SHRINK_EVERY_MS: EVERY_MS
} = CRUSHER_ESCALATOR;

/** How far behind the leader a player may fall at `atMs` into the race. */
export const eliminationGapAt = (atMs: number): number => {
    if (atMs < STARTS_MS) return START;
    const shrinks = 1 + Math.floor((atMs - STARTS_MS) / EVERY_MS);
    return Math.max(MIN, START - shrinks);
};

/**
 * Every instant the gap narrows, earliest first. A narrower gap can crush a
 * player even though nobody pressed anything, so the replay checks these too.
 */
export const gapNarrowingTimes = (): number[] =>
    Array.from({ length: START - MIN }, (_, i) => STARTS_MS + i * EVERY_MS);
