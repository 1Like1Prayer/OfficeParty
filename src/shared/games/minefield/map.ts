/**
 * Lays out a minefield. The field is sized to the number of players, mines
 * are scattered across it, thin near the start and thick near the finish, and
 * every player gets their own spot on the start line. The field is then
 * checked for a route through: it must be possible to get across without
 * setting anything off, even if hard to find without scanning.
 */

import type { RandomSource } from '../random.js';
import { MINEFIELD } from './constants.js';
import type { Mine, MinefieldMap } from './types.js';

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const mineZone = (): { from: number; to: number } => ({
    from: MINEFIELD.START_SAFE_TILES,
    to: MINEFIELD.FINISH_X - MINEFIELD.FINISH_SAFE_TILES
});

/** Mines per tile at column x. */
export const densityAt = (x: number): number => {
    const { from, to } = mineZone();
    const progress = Math.min(Math.max((x - from) / (to - from), 0), 1);
    return lerp(MINEFIELD.EASIEST_DENSITY, MINEFIELD.HARDEST_DENSITY, progress);
};

/** Rows across the field for this many players. Never narrower than for two. */
export const fieldHeightFor = (playerCount: number): number =>
    MINEFIELD.BASE_HEIGHT +
    MINEFIELD.HEIGHT_PER_PLAYER * Math.min(Math.max(playerCount, 2), MINEFIELD.MAX_HEIGHT - MINEFIELD.BASE_HEIGHT);

/** How many mines a field this wide would have at full strength. */
const targetMineCount = (height: number): number => {
    const { from, to } = mineZone();
    let total = 0;
    for (let column = from; column < to; column++) {
        total += densityAt(column + 0.5) * height;
    }
    return Math.round(total);
};

/**
 * Everyone's spot on the start line, side by side around its middle, in a
 * random order so nobody always gets the same side.
 */
export const startPositions = (
    playerIds: readonly string[],
    height: number,
    random: RandomSource
): Record<string, number> => {
    const order = [...playerIds];
    for (let index = order.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [order[index], order[other]] = [order[other]!, order[index]!];
    }
    const spacing = Math.min(MINEFIELD.START_SPACING, (height - 2) / Math.max(order.length - 1, 1));
    const middle = height / 2;
    return Object.fromEntries(
        order.map((playerId, index) => [
            playerId,
            Math.round((middle + (index - (order.length - 1) / 2) * spacing) * 100) / 100
        ])
    );
};

const layMines = (count: number, height: number, random: RandomSource): Mine[] => {
    const { from, to } = mineZone();
    const mines: Mine[] = [];
    const minSpacingSquared = MINEFIELD.MIN_MINE_SPACING ** 2;

    for (let tries = 0; mines.length < count && tries < count * 40; tries++) {
        const x = from + random() * (to - from);
        // Thicker towards the finish: accept a spot in proportion to its density.
        if (random() >= densityAt(x) / MINEFIELD.HARDEST_DENSITY) continue;
        const y = 0.5 + random() * (height - 1);
        if (mines.some((mine) => (mine.x - x) ** 2 + (mine.y - y) ** 2 < minSpacingSquared)) {
            continue;
        }
        mines.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }
    return mines;
};

/**
 * Is there a route from the start to the finish line that stays outside every
 * mine's trigger radius (plus a little clearance)? A search over a fine grid.
 * It starts from the middle of the start line: there are no mines near the
 * start, so every spot on it can reach the middle.
 */
export const hasSafeRoute = (map: MinefieldMap): boolean => {
    const resolution = MINEFIELD.SAFE_PATH_GRID;
    const columns = Math.floor(map.width / resolution);
    const rows = Math.floor(map.height / resolution);
    const clearance = MINEFIELD.TRIGGER_RADIUS + MINEFIELD.PATH_CLEARANCE;

    const blocked = new Uint8Array(columns * rows);
    for (const mine of map.mines) {
        const reach = Math.ceil(clearance / resolution);
        const centreColumn = Math.floor(mine.x / resolution);
        const centreRow = Math.floor(mine.y / resolution);
        for (let row = centreRow - reach; row <= centreRow + reach; row++) {
            for (let column = centreColumn - reach; column <= centreColumn + reach; column++) {
                if (column < 0 || row < 0 || column >= columns || row >= rows) continue;
                const cellX = (column + 0.5) * resolution;
                const cellY = (row + 0.5) * resolution;
                if ((cellX - mine.x) ** 2 + (cellY - mine.y) ** 2 <= clearance ** 2) {
                    blocked[row * columns + column] = 1;
                }
            }
        }
    }

    const startColumn = Math.floor(map.startX / resolution);
    const startRow = Math.floor(map.startY / resolution);
    if (blocked[startRow * columns + startColumn]) return false;

    const finishColumn = Math.ceil(map.finishX / resolution);
    const seen = new Uint8Array(columns * rows);
    const queue: number[] = [startRow * columns + startColumn];
    seen[queue[0]!] = 1;

    for (let head = 0; head < queue.length; head++) {
        const cell = queue[head]!;
        const column = cell % columns;
        const row = Math.floor(cell / columns);
        if (column >= finishColumn) return true;

        for (let dRow = -1; dRow <= 1; dRow++) {
            for (let dColumn = -1; dColumn <= 1; dColumn++) {
                const nextColumn = column + dColumn;
                const nextRow = row + dRow;
                if (nextColumn < 0 || nextRow < 0 || nextColumn >= columns || nextRow >= rows) {
                    continue;
                }
                const next = nextRow * columns + nextColumn;
                if (seen[next] || blocked[next]) continue;
                seen[next] = 1;
                queue.push(next);
            }
        }
    }
    return false;
};

export const generateMap = (
    playerIds: readonly string[],
    random: RandomSource = Math.random
): MinefieldMap => {
    const height = fieldHeightFor(playerIds.length);
    const field = (mines: Mine[]): MinefieldMap => ({
        width: MINEFIELD.WIDTH,
        height,
        startX: MINEFIELD.START_X,
        startY: height / 2,
        starts: startPositions(playerIds, height, random),
        finishX: MINEFIELD.FINISH_X,
        mines
    });

    let count = targetMineCount(height);
    for (let attempt = 0; attempt < MINEFIELD.MAX_GENERATION_ATTEMPTS; attempt++) {
        const map = field(layMines(count, height, random));
        if (hasSafeRoute(map)) return map;
        // Too dense to cross: lay a thinner field next time.
        count = Math.max(0, Math.floor(count * 0.9));
    }
    return field([]);
};
