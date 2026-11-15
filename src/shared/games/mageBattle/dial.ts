/**
 * The dial: plain functions of a dial's current spin and the time, shared by
 * the browser (to draw it and answer a press at once) and the server (to
 * decide what a press scored). Nothing here reads a clock.
 *
 * The dial turns in spins: full turns that each start at the top. A mage gets
 * one press per spin. It scores the block under the dial at once (nothing,
 * off the blocks); any further press that spin is ignored. When the spin ends
 * the dial changes for the next one: after a hit it is 10% faster with the
 * biggest block gone, after a miss (or no press at all) 10% slower with a
 * block back. The blocks move to a new place every spin.
 */

import { seededRandom } from '../random.js';
import { MAGE_BATTLE } from './constants.js';
import type { Dial } from './types.js';

export interface PlacedBlock {
    points: number;
    /** Offsets from the start of the zone, in degrees. */
    fromDeg: number;
    toDeg: number;
}

/** Degrees a second at this level. */
export const speedOf = (level: number): number =>
    MAGE_BATTLE.BASE_DEG_PER_SEC * (1 + MAGE_BATTLE.SPEED_STEP * level);

/** How many blocks are up at this level: 4, 3, 2, 1, then still 1 at the top speed. */
export const blockCountOf = (level: number): number =>
    Math.max(1, MAGE_BATTLE.BLOCKS.length - level);

/** The blocks up at this level, laid end to end, biggest first. */
export const blocksOf = (level: number): PlacedBlock[] => {
    let from = 0;
    return MAGE_BATTLE.BLOCKS.slice(MAGE_BATTLE.BLOCKS.length - blockCountOf(level)).map(
        ({ points, widthDeg }) => {
            const block = { points, fromDeg: from, toDeg: from + widthDeg };
            from += widthDeg;
            return block;
        }
    );
};

export const levelAfterHit = (level: number): number => Math.min(MAGE_BATTLE.MAX_LEVEL, level + 1);

export const levelAfterMiss = (level: number): number =>
    level >= MAGE_BATTLE.MAX_LEVEL ? MAGE_BATTLE.MISS_AT_MAX_LEVEL_TO : Math.max(0, level - 1);

/** A 32-bit FNV-1a hash, the same in every engine. */
const hashString = (text: string): number => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
    }
    return hash | 0;
};

/** How far round from the top a player's blocks start in a given spin. */
export const zoneLead = (seed: number, playerId: string, spin: number): number => {
    const random = seededRandom(seed ^ hashString(playerId) ^ Math.imul(spin + 1, 0x9e3779b1));
    random(); // the first draw of a fresh mulberry32 is weakly mixed
    return MAGE_BATTLE.ZONE_MIN_LEAD_DEG + random() * (MAGE_BATTLE.ZONE_MAX_LEAD_DEG - MAGE_BATTLE.ZONE_MIN_LEAD_DEG);
};

export const startDial = (seed: number, playerId: string): Dial => ({
    level: 0,
    sinceMs: 0,
    zone: zoneLead(seed, playerId, 0),
    spin: 0,
    score: 0,
    pressPoints: null,
    pressedAtMs: null,
    outAtMs: null
});

/** How far the dial has turned this spin. */
const travelled = (dial: Dial, atMs: number): number => (speedOf(dial.level) * (atMs - dial.sinceMs)) / 1000;

/** When this spin ends and the next one starts. */
export const spinEndsAtMs = (dial: Dial): number => dial.sinceMs + 360_000 / speedOf(dial.level);

/** Where the dial points at `atMs` (within this spin), 0..360 clockwise from the top. */
export const angleAt = (dial: Dial, atMs: number): number => travelled(dial, atMs) % 360;

/** The next spin: faster after a hit, slower after a miss or no press at all. */
const nextSpin = (dial: Dial, seed: number, playerId: string): Dial => ({
    level: (dial.pressPoints ?? 0) > 0 ? levelAfterHit(dial.level) : levelAfterMiss(dial.level),
    sinceMs: spinEndsAtMs(dial),
    zone: zoneLead(seed, playerId, dial.spin + 1),
    spin: dial.spin + 1,
    score: dial.score,
    pressPoints: null,
    pressedAtMs: null,
    outAtMs: dial.outAtMs
});

/** Plays out every spin that has ended by `atMs`. */
export const advanceTo = (dial: Dial, atMs: number, seed: number, playerId: string): Dial => {
    let current = dial;
    while (atMs >= spinEndsAtMs(current)) current = nextSpin(current, seed, playerId);
    return current;
};

/** What a press scores at this point of the spin: the block under the dial, or 0. */
export const pointsAt = (dial: Dial, atMs: number): number => {
    const intoZone = travelled(dial, atMs) - dial.zone;
    return blocksOf(dial.level).find((block) => intoZone >= block.fromDeg && intoZone < block.toDeg)?.points ?? 0;
};

/**
 * A press at `atMs`, in whatever spin that falls in. The first press of a
 * spin scores at once; a second one in the same spin changes nothing.
 */
export const pressDial = (
    dial: Dial,
    atMs: number,
    seed: number,
    playerId: string
): { dial: Dial; points: number; counted: boolean } => {
    const current = advanceTo(dial, atMs, seed, playerId);
    if (current.pressPoints !== null) return { dial: current, points: 0, counted: false };
    const points = pointsAt(current, atMs);
    return {
        dial: { ...current, score: current.score + points, pressPoints: points, pressedAtMs: atMs },
        points,
        counted: true
    };
};
