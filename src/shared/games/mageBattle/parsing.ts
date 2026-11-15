/**
 * Validation of untrusted client messages. Anything malformed returns null and
 * is dropped; nothing here throws.
 */

import { MAGE_BATTLE } from './constants.js';
import type { MageBattleResult, PressAction } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

/** The server keeps the score, so a result only says the player has stopped. */
export const parseMageBattleResult = (raw: unknown): MageBattleResult | null =>
    isRecord(raw) ? { timingSuspect: raw.timingSuspect === true } : null;

export const parsePressAction = (raw: unknown): PressAction | null => {
    if (!isRecord(raw) || raw.type !== 'press') return null;
    const { atMs } = raw;
    if (typeof atMs !== 'number' || !Number.isFinite(atMs) || atMs < 0 || atMs > MAGE_BATTLE.ROUND_MS) return null;
    return { type: 'press', atMs };
};
