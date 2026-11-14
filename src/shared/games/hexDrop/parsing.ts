/**
 * Validation of untrusted client messages. Anything malformed returns null and
 * is dropped; nothing here throws.
 */

import { HEX_DROP } from './constants.js';
import { layerHeight, OUT_HEIGHT, TILES } from './arena.js';
import type { HexDropResult, TouchAction } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isWholeIn = (value: unknown, min: number, max: number): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export const parseHexDropResult = (raw: unknown): HexDropResult | null => {
    if (!isRecord(raw)) return null;
    const { outAtMs } = raw;
    if (outAtMs !== null && !isWholeIn(outAtMs, 0, HEX_DROP.MAX_ROUND_MS)) return null;
    return { outAtMs, timingSuspect: raw.timingSuspect === true };
};

export const parseTouchAction = (raw: unknown): TouchAction | null => {
    if (!isRecord(raw) || raw.type !== 'touch') return null;
    if (!isWholeIn(raw.tile, 0, TILES.length - 1)) return null;
    if (!isWholeIn(raw.atMs, 0, HEX_DROP.MAX_ROUND_MS)) return null;
    return { type: 'touch', tile: raw.tile, atMs: raw.atMs };
};

/** How far from the middle anyone can be, with room for falling off the widest layer. */
const REACH_CM = 60 * 100;
const TOP_CM = Math.ceil((layerHeight(0) + 10) * 100);
const BOTTOM_CM = Math.floor((OUT_HEIGHT - 10) * 100);

/**
 * Progress is where the runner is, for drawing them on everyone else's screen:
 *   t:       the round time (ms) the position is for;
 *   x, y, z: position in hundredths of a unit;
 *   out:     1 once they have fallen out.
 * The server never uses it to decide anything.
 */
export const parseHexDropProgress = (raw: unknown): Record<string, number> | null => {
    if (!isRecord(raw)) return null;
    const bounds: Record<string, readonly [number, number]> = {
        t: [0, HEX_DROP.MAX_ROUND_MS],
        x: [-REACH_CM, REACH_CM],
        y: [BOTTOM_CM, TOP_CM],
        z: [-REACH_CM, REACH_CM],
        out: [0, 1]
    };
    const progress: Record<string, number> = {};
    for (const [key, [min, max]] of Object.entries(bounds)) {
        const value = raw[key];
        if (!isWholeIn(value, min, max)) return null;
        progress[key] = value;
    }
    return progress;
};
