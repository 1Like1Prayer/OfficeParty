/**
 * Stop the Clock — rules only.
 *
 * Hit a whole-second target between 2 and 8 seconds. The client times itself
 * with performance.now() and reports integer milliseconds; the server never
 * measures anything, which is why 300 ms of latency cannot change who wins.
 *
 * One scoring round is four targets played back to back, as stages of the
 * same round: the first two with the clock showing, the last two blind. Each
 * target is won by whoever is closest. The round goes to whoever won the most
 * targets; equal wins are split by the total they were off by, all four
 * added up. Only a tie on both goes to a tiebreaker (one plain target).
 *
 * Everything here is a plain function over plain data: no sockets, no clock,
 * no I/O.
 */

import { SELF_TIMED } from '../constants.js';
import { assignSharedRanks } from './ranking.js';
import type {
    AttemptTiming,
    RankedEntry,
    RoundContext,
    ResultEntry,
    SelfTimedGameModule,
    StageAdvance
} from './selfTimed.js';

export const STOP_THE_CLOCK = {
    /** One scoring round per game, made of TARGETS_PER_ROUND targets. */
    ROUNDS_PER_GAME: 1,
    TARGETS_PER_ROUND: 4,
    /** The last this many targets are blind: the clock fades out. */
    BLIND_TARGETS: 2,
    MIN_TARGET_MS: 2_000,
    MAX_TARGET_MS: 8_000,
    /** Targets land on whole seconds so they read cleanly as "4 s". */
    TARGET_STEP_MS: 1_000,
    /**
     * A stopped clock is nonsense past this point; anything longer is a stuck
     * tab or a fabricated number and is rejected rather than scored.
     */
    MAX_ELAPSED_MS: 60_000,
    /**
     * Slack on top of the target before the server resolves the target itself.
     * If someone never reports, it closes at target + 4 s and is scored from
     * whatever arrived.
     */
    RESULT_GRACE_MS: 4_000,
    /**
     * What a target nobody stopped for adds to a player's total: worse than any
     * real attempt (the worst honest miss is 8 s off).
     */
    MISSED_TARGET_MS: 10_000,
    /** Blind targets draw from a narrower, longer band so the gap is worth guessing. */
    BLIND_MIN_TARGET_MS: 4_000,
    /**
     * The opening run-up, before the clock runs (the platform's default is
     * 7.5 s). Long enough for the intro to show everyone sitting round the TVs,
     * glide in to the player's own screen, roll the target and count them in
     * (the TVs' count-in is 5.1 s, slower than the platform's 3.6 s).
     */
    INTRO_COUNTDOWN_MS: 13_000,
    /** Once everyone has stopped, how long the target's scores stay up before the next one. */
    SCORES_BREAK_MS: 5_000,
    /**
     * The run-up to every target after the first: three seconds of "next
     * round" (3, 2, 1), three of the new target rolling, a second and a half
     * of it landed, then the 5.1 s count-in.
     */
    NEXT_TARGET_TIMING: { startLeadMs: 1_500, countdownMs: 11_100 } satisfies AttemptTiming,
    /** The last target's final scores, on the TV, before the results screen. */
    FINISH_ANIMATION_MS: 8_000
} as const;

export interface StopTheClockRound {
    /** Milliseconds the player is trying to hit. */
    targetMs: number;
    /** The clock fades out mid-target. Public: it reveals nothing about results. */
    blind: boolean;
    /** 0-based: which of the round's targets this is. */
    targetIndex: number;
    targetCount: number;
    /** A one-target decider between players tied on wins and total. */
    isTiebreak: boolean;
    /** Everyone this target is for. */
    playerIds: string[];
    /** Where each player stood after the earlier targets. Public: they were all revealed. */
    standingsBefore: Record<string, Standing>;
}

/** A player's score so far in the round. */
export interface Standing {
    /** Targets they were closest on (a shared closest counts for each). */
    wins: number;
    /** Everything they have been off by, added up; a missed target counts MISSED_TARGET_MS. */
    totalErrorMs: number;
    /** Targets they stopped for at all. Someone who never played cannot take the round. */
    played: number;
}

export interface StopTheClockResult {
    /** Client-measured interval between the scheduled start and the stop press. */
    elapsedMs: number;
    /**
     * The client noticed its tab was backgrounded (and therefore its timers
     * throttled) during the round. Kept and shown rather than silently scored,
     * per section 15 of the plan.
     */
    timingSuspect: boolean;
}

/** Blind (faded) for the last BLIND_TARGETS targets: with 4, targets 3 and 4. */
export const isBlindTarget = (targetIndex: number): boolean =>
    targetIndex >= STOP_THE_CLOCK.TARGETS_PER_ROUND - STOP_THE_CLOCK.BLIND_TARGETS;

/** Pick a whole-second target between minMs and the maximum. */
export const pickTargetMs = (minMs: number = STOP_THE_CLOCK.MIN_TARGET_MS): number => {
    const { MAX_TARGET_MS, TARGET_STEP_MS } = STOP_THE_CLOCK;
    const steps = Math.floor((MAX_TARGET_MS - minMs) / TARGET_STEP_MS);
    return minMs + Math.floor(Math.random() * (steps + 1)) * TARGET_STEP_MS;
};

/** Standings as the last stage left them: every stage's ranking carries the running score. */
const standingsAfter = (ranked: readonly RankedEntry[] | undefined): Record<string, Standing> =>
    Object.fromEntries(
        (ranked ?? []).map(({ playerId, detail }) => [
            playerId,
            {
                wins: Number(detail['wins'] ?? 0),
                totalErrorMs: Number(detail['totalErrorMs'] ?? 0),
                played: Number(detail['played'] ?? 0)
            }
        ])
    );

export const createRoundData = (context: RoundContext): StopTheClockRound => {
    const earlier = context.earlierStages ?? [];
    const isTiebreak = context.isTiebreak === true;
    const targetIndex = isTiebreak ? STOP_THE_CLOCK.TARGETS_PER_ROUND : earlier.length;
    const blind = !isTiebreak && isBlindTarget(targetIndex);
    return {
        targetMs: pickTargetMs(blind ? STOP_THE_CLOCK.BLIND_MIN_TARGET_MS : undefined),
        blind,
        targetIndex,
        targetCount: STOP_THE_CLOCK.TARGETS_PER_ROUND,
        isTiebreak,
        playerIds: [...context.playerIds],
        standingsBefore: isTiebreak ? {} : standingsAfter(earlier.at(-1))
    };
};

/** The round's last target, where the score is the whole round's. */
export const isFinalTarget = (round: StopTheClockRound): boolean =>
    !round.isTiebreak && round.targetIndex >= round.targetCount - 1;

/** How far off a report is. Integer milliseconds, so ties are exact. */
export const errorMs = (
    result: StopTheClockResult,
    round: StopTheClockRound
): number => Math.abs(result.elapsedMs - round.targetMs);

export const parseResult = (raw: unknown): StopTheClockResult | null => {
    if (typeof raw !== 'object' || raw === null) return null;
    const { elapsedMs, timingSuspect } = raw as Record<string, unknown>;
    if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs)) return null;
    const rounded = Math.round(elapsedMs);
    if (rounded < 0 || rounded > STOP_THE_CLOCK.MAX_ELAPSED_MS) return null;
    return { elapsedMs: rounded, timingSuspect: timingSuspect === true };
};

/**
 * Progress is display-only — it tells opponents someone's clock is running.
 * It has no effect on the outcome and deliberately does not carry elapsed
 * time, which stays hidden until the reveal.
 */
export const parseProgress = (raw: unknown): Record<string, number> | null => {
    if (typeof raw !== 'object' || raw === null) return null;
    const { running } = raw as Record<string, unknown>;
    if (typeof running !== 'boolean') return null;
    return { running: running ? 1 : 0 };
};

/**
 * A single target on its own, as a tiebreaker plays it: whoever reported,
 * closest first. Equal error is a real tie and shares a rank.
 */
export const rankTarget = (
    entries: ResultEntry<StopTheClockResult>[],
    round: StopTheClockRound
): RankedEntry[] => {
    const scored = entries
        .map((entry) => ({ playerId: entry.playerId, error: errorMs(entry.result, round), result: entry.result }))
        .sort((a, b) => a.error - b.error || a.playerId.localeCompare(b.playerId));
    return assignSharedRanks(scored, (a, b) => a.error === b.error).map(({ item, rank: position }) => ({
        playerId: item.playerId,
        rank: position,
        reported: true,
        detail: {
            elapsedMs: item.result.elapsedMs,
            errorMs: item.error,
            targetMs: round.targetMs,
            timingSuspect: item.result.timingSuspect
        }
    }));
};

/**
 * One target of the round, carrying everyone's running score in `detail`.
 *
 * Every target but the last is ranked by how far off each player was,
 * closest first, with those who never reported listed last as missed (a miss
 * adds MISSED_TARGET_MS to their total). That ranking is shown between
 * targets; it decides nothing but who won the target. The last target ranks
 * the whole round: most targets won, then the lowest total. Equal on both is
 * a real tie and shares a rank, the runner's signal for a tiebreaker.
 * Anyone who never stopped for a single target is left out of that ranking,
 * so a round nobody played awards nobody.
 */
export const rank = (
    entries: ResultEntry<StopTheClockResult>[],
    round: StopTheClockRound
): RankedEntry[] => {
    if (round.isTiebreak) return rankTarget(entries, round);

    const reported = new Map(entries.map((entry) => [entry.playerId, entry.result]));
    const players = [...new Set([...round.playerIds, ...reported.keys()])];
    const rows = players.map((playerId) => {
        const result = reported.get(playerId) ?? null;
        const error = result === null ? null : errorMs(result, round);
        const before = round.standingsBefore[playerId] ?? { wins: 0, totalErrorMs: 0, played: 0 };
        return { playerId, result, error, before };
    });

    // Closest on this target wins it; a shared closest is a win for each.
    const closest = Math.min(...rows.flatMap(({ error }) => (error === null ? [] : [error])));
    const scored = rows.map((row) => ({
        ...row,
        wins: row.before.wins + (row.error !== null && row.error === closest ? 1 : 0),
        total: row.before.totalErrorMs + (row.error ?? STOP_THE_CLOCK.MISSED_TARGET_MS),
        played: row.before.played + (row.error === null ? 0 : 1)
    }));

    const isFinal = isFinalTarget(round);
    type Row = (typeof scored)[number];
    const compare = isFinal
        ? (a: Row, b: Row) => b.wins - a.wins || a.total - b.total
        : (a: Row, b: Row) =>
              Number(a.error === null) - Number(b.error === null) || (a.error ?? 0) - (b.error ?? 0);
    const sorted = scored
        .filter((row) => !isFinal || row.played > 0)
        .sort((a, b) => compare(a, b) || a.playerId.localeCompare(b.playerId));

    return assignSharedRanks(sorted, (a, b) => compare(a, b) === 0).map(({ item, rank: position }) => ({
        playerId: item.playerId,
        rank: position,
        reported: item.result !== null,
        detail: {
            ...(item.result === null
                ? { missed: true }
                : {
                      elapsedMs: item.result.elapsedMs,
                      errorMs: item.error!,
                      timingSuspect: item.result.timingSuspect
                  }),
            targetMs: round.targetMs,
            wins: item.wins,
            totalErrorMs: item.total,
            played: item.played
        }
    }));
};

export const resultTimeoutMs = (round: StopTheClockRound): number =>
    round.targetMs + STOP_THE_CLOCK.RESULT_GRACE_MS;

/** Between targets, everyone plays on: the scores are up a moment, then the next target runs. */
export const nextStage = (_ranked: RankedEntry[], round: StopTheClockRound): StageAdvance | null =>
    round.isTiebreak || isFinalTarget(round)
        ? null
        : {
              participants: round.playerIds,
              pauseMs: STOP_THE_CLOCK.SCORES_BREAK_MS,
              timing: STOP_THE_CLOCK.NEXT_TARGET_TIMING
          };

export const stopTheClockModule: SelfTimedGameModule<
    StopTheClockRound,
    StopTheClockResult
> = {
    id: 'stop-the-clock',
    title: 'Stop the Clock',
    kind: 'self-timed',
    roundsPerGame: STOP_THE_CLOCK.ROUNDS_PER_GAME,
    finishAnimationMs: STOP_THE_CLOCK.FINISH_ANIMATION_MS,
    createRoundData,
    parseResult,
    parseProgress,
    resultTimeoutMs,
    rank,
    nextStage,
    openingTiming: () => ({
        startLeadMs: SELF_TIMED.START_LEAD_MS,
        countdownMs: STOP_THE_CLOCK.INTRO_COUNTDOWN_MS
    })
};
