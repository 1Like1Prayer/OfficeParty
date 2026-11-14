/**
 * The race rules, as a replay.
 *
 * Each browser plays on its own clock and reports every press with a time.
 * The server then replays all players' presses in time order and applies the
 * rules itself, so the outcome never depends on when messages arrived and a
 * client cannot simply claim a score.
 *
 * Rules:
 *  - everyone starts on STARTING_SCORE;
 *  - a press scores a point if it matches the arrow currently showing; the
 *    arrow moves on after every press, right or wrong;
 *  - when the leader (highest score) is at least the current elimination gap
 *    ahead of a player, that player is crushed and their score is frozen. The
 *    gap narrows over time (gap.ts), so a player can be crushed by the gap
 *    narrowing as well as by a press;
 *  - the race ends when one player is left, or at MAX_RACE_MS.
 *
 * Plain functions over plain data: no sockets, no clock.
 */

import { CRUSHER_ESCALATOR } from './constants.js';
import { eliminationGapAt, gapNarrowingTimes } from './gap.js';
import type { ArrowSequence, Input } from './types.js';

export interface Racer {
    playerId: string;
    inputs: readonly Input[];
    arrows: ArrowSequence;
}

export interface RaceOutcome {
    playerId: string;
    score: number;
    /** When the player was crushed, or null if they survived the race. */
    eliminatedAtMs: number | null;
}

interface JudgedPress {
    playerId: string;
    points: number;
}

/** Every press, judged against the arrow showing when it was made, by time. */
const judgePressesByTime = (racers: readonly Racer[]): Map<number, JudgedPress[]> => {
    const byTime = new Map<number, JudgedPress[]>();
    for (const { playerId, inputs, arrows } of racers) {
        inputs.forEach((input, pressIndex) => {
            const points =
                input.direction === arrows(pressIndex)
                    ? CRUSHER_ESCALATOR.POINTS_PER_CORRECT_INPUT
                    : 0;
            const atSameTime = byTime.get(input.atMs) ?? [];
            atSameTime.push({ playerId, points });
            byTime.set(input.atMs, atSameTime);
        });
    }
    return byTime;
};

const isAlive = (outcome: RaceOutcome): boolean => outcome.eliminatedAtMs === null;

export const simulateRace = (racers: readonly Racer[]): RaceOutcome[] => {
    const states = new Map<string, RaceOutcome>(
        racers.map(({ playerId }) => [
            playerId,
            { playerId, score: CRUSHER_ESCALATOR.STARTING_SCORE, eliminatedAtMs: null }
        ])
    );
    const all = [...states.values()];

    const pressesByTime = judgePressesByTime(racers);
    // Presses, plus the moments the gap narrows, in time order.
    const instants = [...new Set([...pressesByTime.keys(), ...gapNarrowingTimes()])].sort(
        (a, b) => a - b
    );

    for (const atMs of instants) {
        if (all.filter(isAlive).length <= 1) break; // The race is over.

        // Everything at the same instant counts before anyone is crushed, so
        // simultaneous presses can't be decided by processing order.
        for (const press of pressesByTime.get(atMs) ?? []) {
            const state = states.get(press.playerId)!;
            if (isAlive(state)) state.score += press.points;
        }

        const lead = Math.max(...all.map((state) => state.score));
        const gap = eliminationGapAt(atMs);
        for (const state of all.filter(isAlive)) {
            if (lead - state.score >= gap) state.eliminatedAtMs = atMs;
        }
    }

    return racers.map(({ playerId }) => ({ ...states.get(playerId)! }));
};

/**
 * Best first: survivors, then whoever lasted longest. Within the same
 * survival time the higher score is better.
 */
export const compareOutcomes = (a: RaceOutcome, b: RaceOutcome): number => {
    const survivalMs = (outcome: RaceOutcome): number =>
        outcome.eliminatedAtMs ?? Number.POSITIVE_INFINITY;

    if (survivalMs(a) !== survivalMs(b)) return survivalMs(a) > survivalMs(b) ? -1 : 1;
    return b.score - a.score;
};

export const isSameOutcome = (a: RaceOutcome, b: RaceOutcome): boolean =>
    compareOutcomes(a, b) === 0;
