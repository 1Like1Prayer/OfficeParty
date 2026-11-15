/**
 * The arena: four layers of hexagonal tiles, stacked. The top layer is a ring
 * of 12 tiles set apart from each other, so getting from one to the next
 * takes a jump; the three below are solid floors, each wider than the one
 * above. Fixed for every round, so both sides compute it instead of sending it.
 */

import { HEX_DROP } from './constants.js';
import type { Tile } from './types.js';

const SQRT3 = Math.sqrt(3);

/** The six axial directions, in ring order. */
const DIRECTIONS: readonly (readonly [number, number])[] = [
    [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]
];

/** Every axial cell exactly `radius` steps from the middle, walking round the ring. */
const ring = (radius: number): [number, number][] => {
    const cells: [number, number][] = [];
    let q = DIRECTIONS[4]![0] * radius;
    let r = DIRECTIONS[4]![1] * radius;
    for (const [dq, dr] of DIRECTIONS) {
        for (let step = 0; step < radius; step++) {
            cells.push([q, r]);
            q += dq;
            r += dr;
        }
    }
    return cells;
};

/** Every axial cell up to `radius` steps from the middle. */
const disc = (radius: number): [number, number][] => {
    const cells: [number, number][] = [[0, 0]];
    for (let step = 1; step <= radius; step++) cells.push(...ring(step));
    return cells;
};

/** Centre of an axial cell for pointy-topped tiles of this radius. */
const centreOf = ([q, r]: readonly [number, number], spread = 1) => ({
    x: HEX_DROP.TILE_RADIUS * SQRT3 * (q + r / 2) * spread,
    z: HEX_DROP.TILE_RADIUS * 1.5 * r * spread
});

export const LAYER_COUNT = 1 + HEX_DROP.LOWER_RINGS.length;

/** Height of a layer's top surface. The bottom layer is at 0. */
export const layerHeight = (layer: number): number => (LAYER_COUNT - 1 - layer) * HEX_DROP.LAYER_GAP;

/** Below this height a runner is out. */
export const OUT_HEIGHT = -HEX_DROP.OUT_DEPTH;

const buildTiles = (): Tile[] => {
    const tiles: Tile[] = [];
    const add = (layer: number, cells: [number, number][], spread = 1) => {
        for (const cell of cells) tiles.push({ id: tiles.length, layer, ...centreOf(cell, spread) });
    };
    add(0, ring(HEX_DROP.TOP_RING), HEX_DROP.TOP_SPREAD);
    HEX_DROP.LOWER_RINGS.forEach((radius, index) => { add(index + 1, disc(radius)); });
    return tiles;
};

/** Every tile, top layer first. */
export const TILES: readonly Tile[] = buildTiles();

/** The top layer's tiles: where everyone starts. */
export const TOP_TILES: readonly Tile[] = TILES.filter((tile) => tile.layer === 0);

const TILES_BY_LAYER: readonly (readonly Tile[])[] = Array.from({ length: LAYER_COUNT }, (_, layer) =>
    TILES.filter((tile) => tile.layer === layer)
);

/**
 * Is (x, z) on a pointy-topped tile centred at (cx, cz)? `grace` widens the
 * tile by that much all round, so standing right on the edge still counts.
 */
export const isOnTile = (tile: Tile, x: number, z: number, grace = 0): boolean => {
    const radius = HEX_DROP.TILE_RADIUS + grace;
    const dx = Math.abs(x - tile.x);
    const dz = Math.abs(z - tile.z);
    return dx <= (radius * SQRT3) / 2 && dz <= radius - dx / SQRT3;
};

/** The standing tile of this layer under (x, z), or null. */
export const tileUnder = (
    layer: number,
    x: number,
    z: number,
    isStanding: (tile: Tile) => boolean
): Tile | null => {
    const reach = HEX_DROP.TILE_RADIUS + HEX_DROP.FOOT_GRACE;
    for (const tile of TILES_BY_LAYER[layer] ?? []) {
        if (Math.abs(x - tile.x) > reach || Math.abs(z - tile.z) > reach) continue;
        if (isOnTile(tile, x, z, HEX_DROP.FOOT_GRACE) && isStanding(tile)) return tile;
    }
    return null;
};
