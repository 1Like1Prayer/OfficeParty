/**
 * Mage Battle as a game module.
 *
 * Every mage fights every other one. Each has a dial that turns round a ring,
 * with up to four blocks on it, biggest to smallest, worth 1 to 4 points.
 * Each full turn (a spin) the mage gets one press: over a block it scores
 * that block's points, and the next spin is 10% faster (140% at most) with
 * the biggest block gone. Pressing anywhere else, or not at all, is a miss:
 * the next spin is 10% slower with a block back (a miss at full speed drops
 * back to 120% and two blocks). Fall 7 points behind the leader and you are out. The
 * last mage standing wins, or after 60 seconds, the highest score.
 *
 * How it stays fair over a network:
 *  - Each browser turns its own dial, so a press answers at once.
 *  - The press goes to the server with its time. The server plays that
 *    mage's dial on (the same functions, see dial.ts) to decide what it
 *    scored, so the score is the server's. The time is trusted within the
 *    netcode guide's rewind cap: a late report counts as 250 ms late at most.
 *  - One press per spin means a press is always answered long before the
 *    mage can press again, so the client never has two in flight: it simply
 *    takes the dial the server sends back.
 *  - Every mage's dial and score lives in the shared world, so every screen
 *    can draw everyone's duel, and knock-outs reach everyone at once.
 *  - The battle bar (how far each mage is ahead or behind, see progress.ts) is
 *    worked out from those scores on every screen, so it needs no progress
 *    messages, and the server knocks out with the same function the bar uses.
 */

import { assignSharedRanks } from '../ranking.js';
import type {
    RankedEntry,
    ResultEntry,
    RoundContext,
    SelfTimedGameModule,
    SharedWorld,
    SharedWorldView
} from '../selfTimed.js';
import { MAGE_BATTLE } from './constants.js';
import { pressDial, startDial } from './dial.js';
import { parseMageBattleResult, parsePressAction } from './parsing.js';
import { battleBar, dueForKnockout, type BattleBar, type Standing } from './progress.js';
import type { Dial, MageBattleResult, MageBattleRound, PressReply } from './types.js';

export const createRoundData = (
    context: Pick<RoundContext, 'playerIds'>,
    random: () => number = Math.random
): MageBattleRound => ({
    seed: Math.floor(random() * 2 ** 31),
    playerIds: [...context.playerIds]
});

/* ------------------------- the dials in the shared world ------------------------- */

const DIAL_FIELDS = ['level', 'sinceMs', 'zone', 'spin', 'score'] as const;
/** Fields that may be null, kept in the world as -1 (no press this spin). */
const PRESS_FIELDS = ['pressPoints', 'pressedAtMs'] as const;
const NOT_PRESSED = -1;

type DialField = (typeof DIAL_FIELDS)[number] | (typeof PRESS_FIELDS)[number] | 'outAtMs';

/**
 * The shared-world key for one field of a player's dial, e.g. `abc123.score`.
 * `pressPoints` and `pressedAtMs` are -1 when they have not pressed this spin;
 * `outAtMs` is absent while they are still fighting.
 */
export const dialKey = (playerId: string, field: DialField): string => `${playerId}.${field}`;

/** A player's dial as the world holds it; one that has never pressed is at its start. */
export const readDial = (world: SharedWorldView, round: MageBattleRound, playerId: string): Dial => {
    const outAtMs = world.get(dialKey(playerId, 'outAtMs')) ?? null;
    if (world.get(dialKey(playerId, 'spin')) === undefined) {
        return { ...startDial(round.seed, playerId), outAtMs };
    }
    const value = (field: DialField) => world.get(dialKey(playerId, field)) ?? NOT_PRESSED;
    const pressed = (field: (typeof PRESS_FIELDS)[number]) => {
        const stored = value(field);
        return stored === NOT_PRESSED ? null : stored;
    };
    return {
        level: value('level'),
        sinceMs: value('sinceMs'),
        zone: value('zone'),
        spin: value('spin'),
        score: value('score'),
        pressPoints: pressed('pressPoints'),
        pressedAtMs: pressed('pressedAtMs'),
        outAtMs
    };
};

const writeDial = (world: SharedWorld, playerId: string, dial: Dial): void => {
    for (const field of DIAL_FIELDS) world.set(dialKey(playerId, field), dial[field]);
    for (const field of PRESS_FIELDS) world.set(dialKey(playerId, field), dial[field] ?? NOT_PRESSED);
};

const isOut = (world: SharedWorldView, playerId: string): boolean =>
    world.get(dialKey(playerId, 'outAtMs')) !== undefined;

/** Every mage's score and whether they are out: what the battle bar is drawn from. */
export const readStandings = (world: SharedWorldView, round: MageBattleRound): Standing[] =>
    round.playerIds.map((playerId) => ({
        playerId,
        score: readDial(world, round, playerId).score,
        out: isOut(world, playerId)
    }));

/** The battle bar as it stands, for drawing every mage's marker (see progress.ts). */
export const readBattleBar = (world: SharedWorldView, round: MageBattleRound): BattleBar =>
    battleBar(readStandings(world, round));

/**
 * Knock out everyone who has reached the bar's knock-out line. Only a hit can
 * move the line (a miss never costs points), so this runs after each hit.
 */
const knockOut = (world: SharedWorld, round: MageBattleRound, atMs: number): string[] => {
    const knocked = dueForKnockout(readStandings(world, round));
    for (const playerId of knocked) world.set(dialKey(playerId, 'outAtMs'), atMs);
    return knocked;
};

/**
 * A mage pressed. The server plays their dial on to the press and keeps what
 * it scored. Only the first press of a spin counts; a second one, or one from
 * a mage who is out, is answered with their dial, unchanged.
 */
export const handlePress = (
    round: MageBattleRound,
    playerId: string,
    raw: unknown,
    world: SharedWorld
): PressReply | null => {
    const press = parsePressAction(raw);
    if (press === null || !round.playerIds.includes(playerId)) return null;
    if (press.atMs > world.raceMs + MAGE_BATTLE.MAX_PRESS_LEAD_MS) return null;

    const before = readDial(world, round, playerId);
    if (before.outAtMs !== null) return { counted: false, points: 0, dial: before, eliminated: [] };

    // Never before the spin the server already has them in: spins only go forward.
    const atMs = Math.max(press.atMs, world.raceMs - MAGE_BATTLE.MAX_PRESS_LAG_MS, before.sinceMs);
    const { dial, points, counted } = pressDial(before, atMs, round.seed, playerId);
    if (!counted) return { counted, points, dial, eliminated: [] };
    writeDial(world, playerId, dial);
    const eliminated = points > 0 ? knockOut(world, round, atMs) : [];
    return { counted, points, dial, eliminated };
};

/* ---------------------------------- the round ---------------------------------- */

interface FinalStanding {
    playerId: string;
    score: number;
    outAtMs: number | null;
}

/** Best first: still standing, then knocked out later, then the higher score. */
const compareStandings = (a: FinalStanding, b: FinalStanding): number => {
    if (a.outAtMs !== b.outAtMs) {
        if (a.outAtMs === null) return -1;
        if (b.outAtMs === null) return 1;
        return b.outAtMs - a.outAtMs;
    }
    return b.score - a.score;
};

const rank = (
    entries: ResultEntry<MageBattleResult>[],
    round: MageBattleRound,
    world: SharedWorldView = { get: () => undefined }
): RankedEntry[] => {
    const standings = entries.map(({ playerId, result }) => {
        const dial = readDial(world, round, playerId);
        return { playerId, score: dial.score, outAtMs: dial.outAtMs, timingSuspect: result.timingSuspect };
    });
    const sorted = standings.sort((a, b) => compareStandings(a, b) || a.playerId.localeCompare(b.playerId));
    return assignSharedRanks(sorted, (a, b) => compareStandings(a, b) === 0).map(({ item, rank: position }) => ({
        playerId: item.playerId,
        rank: position,
        reported: true,
        detail: {
            score: item.score,
            survived: item.outAtMs === null,
            ...(item.outAtMs !== null && { outAtMs: item.outAtMs }),
            timingSuspect: item.timingSuspect
        }
    }));
};

/**
 * One mage left standing: they have won, and must be told to stop. Decided
 * from the shared world, so it does not wait on anyone's report. A lone mage
 * (nobody to knock out) fights the clock instead.
 */
const shouldCloseEarly = (
    _reported: readonly ResultEntry<MageBattleResult>[],
    _participantCount: number,
    round: MageBattleRound,
    world?: SharedWorldView
): boolean => {
    if (world === undefined) return false;
    const out = round.playerIds.filter((playerId) => isOut(world, playerId)).length;
    return out >= 1 && round.playerIds.length - out <= 1;
};

export const mageBattleModule: SelfTimedGameModule<MageBattleRound, MageBattleResult> = {
    id: 'mage-battle',
    title: 'Mage Battle',
    kind: 'self-timed',
    roundsPerGame: MAGE_BATTLE.ROUNDS_PER_GAME,
    finishAnimationMs: MAGE_BATTLE.FINISH_ANIMATION_MS,
    createRoundData: (context) => createRoundData(context),
    parseResult: (raw) => parseMageBattleResult(raw),
    // Every dial is in the shared world already: there is no progress to send.
    parseProgress: () => null,
    handleAction: (round, playerId, raw, world) => handlePress(round, playerId, raw, world),
    resultTimeoutMs: () => MAGE_BATTLE.ROUND_MS + MAGE_BATTLE.RESULT_GRACE_MS,
    rank,
    shouldCloseEarly
};
