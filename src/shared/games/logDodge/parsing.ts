/**
 * Validation of untrusted client messages. Anything malformed returns null and
 * is dropped by the runner; nothing here throws.
 */

import { ACTIONS, LOG_DODGE } from './constants.js';
import type { Action, Input, LogDodgeResult } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isAction = (value: unknown): value is Action =>
    typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);

const parseInput = (raw: unknown, durationMs: number): Input | null => {
    if (!isRecord(raw)) return null;
    const { action, atMs } = raw;
    if (!isAction(action)) return null;
    if (typeof atMs !== 'number' || !Number.isFinite(atMs)) return null;

    const rounded = Math.round(atMs);
    return rounded >= 0 && rounded <= durationMs ? { action, atMs: rounded } : null;
};

export const parseLogDodgeResult = (
    raw: unknown,
    durationMs: number = LOG_DODGE.DURATION_MS
): LogDodgeResult | null => {
    if (!isRecord(raw) || !Array.isArray(raw.inputs)) return null;
    if (raw.inputs.length > LOG_DODGE.MAX_INPUTS) return null;

    const inputs: Input[] = [];
    for (const rawInput of raw.inputs) {
        const input = parseInput(rawInput, durationMs);
        if (input === null) return null;

        // Presses happen in order; a time that goes backwards is a bad report.
        const previous = inputs[inputs.length - 1];
        if (previous !== undefined && input.atMs < previous.atMs) return null;
        inputs.push(input);
    }
    return { inputs, timingSuspect: raw.timingSuspect === true };
};

/**
 * Progress is display-only: the player's hit count, so opponents can see who
 * is on the ropes, and their latest press, so other screens can play it.
 * The server never uses either to decide anything; it judges the full list of
 * presses in the result.
 *
 * The press is optional (a player who has not pressed yet sends none) and
 * comes as a pair: `pressAction`, an index into ACTIONS, and `pressAtMs`, when
 * in the round it was pressed. A half or out-of-range pair drops the message.
 */
export const parseLogDodgeProgress = (
    raw: unknown,
    durationMs: number = LOG_DODGE.DURATION_MS
): Record<string, number> | null => {
    if (!isRecord(raw)) return null;
    const { hits, pressAction, pressAtMs } = raw;
    if (typeof hits !== 'number' || !Number.isInteger(hits)) return null;
    if (hits < 0 || hits > LOG_DODGE.MAX_HITS) return null;

    if (pressAction === undefined && pressAtMs === undefined) return { hits };
    if (typeof pressAction !== 'number' || !Number.isInteger(pressAction)) return null;
    if (pressAction < 0 || pressAction >= ACTIONS.length) return null;
    if (typeof pressAtMs !== 'number' || !Number.isInteger(pressAtMs)) return null;
    if (pressAtMs < 0 || pressAtMs > durationMs) return null;
    return { hits, pressAction, pressAtMs };
};
