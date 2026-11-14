/**
 * Validation of untrusted client messages. Anything malformed returns null and
 * is dropped by the runner; nothing here throws.
 */

import { CRUSHER_ESCALATOR, DIRECTIONS } from './constants.js';
import type { CrusherEscalatorResult, Direction, Input } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isDirection = (value: unknown): value is Direction =>
    typeof value === 'string' && (DIRECTIONS as readonly string[]).includes(value);

const parseInput = (raw: unknown): Input | null => {
    if (!isRecord(raw)) return null;
    const { direction, atMs } = raw;
    if (!isDirection(direction)) return null;
    if (typeof atMs !== 'number' || !Number.isFinite(atMs)) return null;

    const rounded = Math.round(atMs);
    return rounded >= 0 && rounded <= CRUSHER_ESCALATOR.MAX_RACE_MS
        ? { direction, atMs: rounded }
        : null;
};

export const parseCrusherEscalatorResult = (
    raw: unknown
): CrusherEscalatorResult | null => {
    if (!isRecord(raw) || !Array.isArray(raw.inputs)) return null;
    if (raw.inputs.length > CRUSHER_ESCALATOR.MAX_INPUTS) return null;

    const inputs: Input[] = [];
    let lastReportedMs = 0;
    for (const rawInput of raw.inputs) {
        const input = parseInput(rawInput);
        if (input === null) return null;

        // Presses happen in order; a time that goes backwards is a bad report.
        if (input.atMs < lastReportedMs) return null;
        lastReportedMs = input.atMs;

        // Presses closer together than humanly possible are spaced out rather
        // than rejected, so a glitch costs nothing and a burst can't score at once.
        const previous = inputs.at(-1);
        const atMs =
            previous === undefined
                ? input.atMs
                : Math.max(input.atMs, previous.atMs + CRUSHER_ESCALATOR.MIN_PRESS_INTERVAL_MS);
        if (atMs > CRUSHER_ESCALATOR.MAX_RACE_MS) break; // Spaced past the end: can't count.
        inputs.push({ direction: input.direction, atMs });
    }
    return { inputs, timingSuspect: raw.timingSuspect === true };
};

/**
 * Progress is display-only: the player's current score, so opponents can see
 * the gap to the leader. The server never uses it to decide anything.
 */
export const parseCrusherEscalatorProgress = (
    raw: unknown
): Record<string, number> | null => {
    if (!isRecord(raw)) return null;
    const { score } = raw;
    if (typeof score !== 'number' || !Number.isInteger(score)) return null;
    return score >= 0 && score <= CRUSHER_ESCALATOR.MAX_INPUTS ? { score } : null;
};
