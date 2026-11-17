/**
 * Hex Drop as a game module.
 *
 * Everyone starts on the top layer of a stack of hexagonal tiles. A tile drops
 * two seconds after someone first stands on it, so the floor disappears from
 * under the runners as they go; fall through every layer and you are out. The
 * last one still up wins.
 *
 * How it stays fair over a network (see the netcode guides):
 *  - Each browser moves its own runner itself, so a key press answers at once.
 *    Runners never touch each other, so nothing about one runner's movement
 *    has to be settled between screens.
 *  - The server owns the tiles. A runner's browser reports each tile they step
 *    on, with the time; the server keeps the earliest touch and publishes when
 *    that tile drops. A drop is known two seconds ahead, far longer than any
 *    connection takes, so every screen removes it at the same instant on the
 *    shared clock.
 *  - Each runner's position is shared 20 times a second, and the others are
 *    drawn a little in the past, between two reports, so they move smoothly.
 *  - A runner reports the moment they fall out. Once one is left, the runner
 *    tells them to stop, and they report too.
 */

import { assignSharedRanks } from '../ranking.js';
import type { RandomSource } from '../random.js';
import type {
    RankedEntry,
    ResultEntry,
    RoundContext,
    SelfTimedGameModule,
    SharedWorld
} from '../selfTimed.js';
import { TOP_TILES } from './arena.js';
import { HEX_DROP } from './constants.js';
import { parseHexDropProgress, parseHexDropResult, parseTouchAction } from './parsing.js';
import type { HexDropResult, HexDropRound, TouchReply } from './types.js';

/** Players spread round the top ring as evenly as their number allows, in a random order. */
export const createRoundData = (
    context: Pick<RoundContext, 'playerIds'>,
    random: RandomSource = Math.random
): HexDropRound => {
    const order = [...context.playerIds];
    for (let index = order.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [order[index], order[other]] = [order[other]!, order[index]!];
    }
    const offset = Math.floor(random() * TOP_TILES.length);
    return {
        spawns: Object.fromEntries(
            order.map((playerId, index) => [
                playerId,
                TOP_TILES[(offset + Math.floor((index * TOP_TILES.length) / order.length)) % TOP_TILES.length]!.id
            ])
        )
    };
};

/** The key a tile's drop time is kept under in the shared world. */
export const tileKey = (tileId: number): string => String(tileId);

/**
 * A runner stood on a tile. The earliest touch decides when it drops. The
 * reported time is trusted within reason: a late report is taken as late as
 * MAX_TOUCH_LAG_MS ago at most, and one from the future is refused.
 */
export const handleTouch = (raw: unknown, world: SharedWorld): TouchReply | null => {
    const touch = parseTouchAction(raw);
    if (touch === null || touch.atMs > world.raceMs + HEX_DROP.MAX_TOUCH_LEAD_MS) return null;

    const touchedAtMs = Math.max(touch.atMs, world.raceMs - HEX_DROP.MAX_TOUCH_LAG_MS, 0);
    const key = tileKey(touch.tile);
    const fallAtMs = Math.min(world.get(key) ?? Infinity, touchedAtMs + HEX_DROP.FALL_DELAY_MS);
    world.set(key, fallAtMs);
    return { tile: touch.tile, fallAtMs };
};

/**
 * Best first: still up, then whoever fell out last. Two still up are level,
 * and go to a tiebreaker (Infinity - Infinity would be NaN, never a tie).
 */
const compareResults = (a: HexDropResult, b: HexDropResult): number => {
    if (a.outAtMs === b.outAtMs) return 0;
    if (a.outAtMs === null) return -1;
    if (b.outAtMs === null) return 1;
    return b.outAtMs - a.outAtMs;
};

const rank = (entries: ResultEntry<HexDropResult>[]): RankedEntry[] => {
    const sorted = [...entries].sort(
        (a, b) => compareResults(a.result, b.result) || a.playerId.localeCompare(b.playerId)
    );
    return assignSharedRanks(sorted, (a, b) => compareResults(a.result, b.result) === 0).map(
        ({ item, rank: position }) => ({
            playerId: item.playerId,
            rank: position,
            reported: true,
            detail: {
                survived: item.result.outAtMs === null,
                ...(item.result.outAtMs !== null && { outAtMs: item.result.outAtMs }),
                timingSuspect: item.result.timingSuspect
            }
        })
    );
};

/**
 * Everyone but one has fallen out: the last runner up has won, and must be
 * told to stop and report, since they would otherwise keep running.
 */
const shouldCloseEarly = (
    reported: readonly ResultEntry<HexDropResult>[],
    participantCount: number
): boolean => reported.length >= 1 && participantCount - reported.length <= 1;

export const hexDropModule: SelfTimedGameModule<HexDropRound, HexDropResult> = {
    id: 'hex-drop',
    title: 'Hex Drop',
    kind: 'self-timed',
    roundsPerGame: HEX_DROP.ROUNDS_PER_GAME,
    finishAnimationMs: HEX_DROP.FINISH_ANIMATION_MS,
    progressHz: HEX_DROP.PROGRESS_HZ,
    createRoundData: (context) => createRoundData(context),
    parseResult: (raw) => parseHexDropResult(raw),
    parseProgress: (raw) => parseHexDropProgress(raw),
    handleAction: (_round, _playerId, raw, world) => handleTouch(raw, world),
    resultTimeoutMs: () => HEX_DROP.MAX_ROUND_MS + HEX_DROP.RESULT_GRACE_MS,
    rank,
    shouldCloseEarly
};
