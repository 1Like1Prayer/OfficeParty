/**
 * Crusher Escalator as a self-timed game module.
 *
 * Every player climbs their own endless sequence of arrows. Pressing the
 * arrow that's showing scores a point; the arrow changes on every press. Fall
 * too far behind the leader and you are crushed, and the allowed gap narrows
 * as the race goes on. Last one standing wins.
 *
 * The browser runs its own race and reports every press with a time; the
 * server replays all players together (see race.ts). That keeps the game
 * latency-proof like the other self-timed games, while still letting players
 * affect each other through the leader's score.
 */

import { assignSharedRanks } from '../ranking.js';
import type { RandomSource } from '../random.js';
import type {
    RankedEntry,
    ResultEntry,
    RoundContext,
    SelfTimedGameModule
} from '../selfTimed.js';
import { CRUSHER_ESCALATOR } from './constants.js';
import { parseCrusherEscalatorProgress, parseCrusherEscalatorResult } from './parsing.js';
import {
    compareOutcomes,
    isSameOutcome,
    simulateRace,
    type RaceOutcome,
    type Racer
} from './race.js';
import { arrowSequence, generatePlayerSeeds } from './stream.js';
import type { CrusherEscalatorResult, CrusherEscalatorRound } from './types.js';

const createRoundData = (
    context: RoundContext,
    random: RandomSource = Math.random
): CrusherEscalatorRound => ({
    seeds: generatePlayerSeeds(context.playerIds, random)
});

/** Measured from when timing starts, like every self-timed game. */
const resultTimeoutMs = (): number =>
    CRUSHER_ESCALATOR.MAX_RACE_MS + CRUSHER_ESCALATOR.RESULT_GRACE_MS;

const toRacers = (
    entries: ResultEntry<CrusherEscalatorResult>[],
    round: CrusherEscalatorRound
): Racer[] =>
    entries.flatMap(({ playerId, result }) => {
        const seed = round.seeds[playerId];
        return seed === undefined
            ? []
            : [{ playerId, inputs: result.inputs, arrows: arrowSequence(seed) }];
    });

const rank = (
    entries: ResultEntry<CrusherEscalatorResult>[],
    round: CrusherEscalatorRound
): RankedEntry[] => {
    const timingSuspectByPlayer = new Map(
        entries.map(({ playerId, result }) => [playerId, result.timingSuspect])
    );

    const outcomes = simulateRace(toRacers(entries, round)).sort(
        (a, b) => compareOutcomes(a, b) || a.playerId.localeCompare(b.playerId)
    );

    return assignSharedRanks(outcomes, isSameOutcome).map(
        ({ item, rank: position }: { item: RaceOutcome; rank: number }) => ({
            playerId: item.playerId,
            rank: position,
            reported: true,
            detail: {
                score: item.score,
                survived: item.eliminatedAtMs === null,
                ...(item.eliminatedAtMs !== null && {
                    eliminatedAtMs: item.eliminatedAtMs
                }),
                timingSuspect: timingSuspectByPlayer.get(item.playerId) ?? false
            }
        })
    );
};

/**
 * The race is over once one player is left, so as soon as everyone else has
 * been crushed and reported, the last player racing must stop and report:
 * they can't tell the race has ended except by watching others.
 */
const shouldCloseEarly = (
    reported: readonly ResultEntry<CrusherEscalatorResult>[],
    participantCount: number
): boolean => reported.length >= 1 && participantCount - reported.length <= 1;

export const crusherEscalatorModule: SelfTimedGameModule<
    CrusherEscalatorRound,
    CrusherEscalatorResult
> = {
    id: 'crusher-escalator',
    title: 'Crusher Escalator',
    kind: 'self-timed',
    roundsPerGame: CRUSHER_ESCALATOR.ROUNDS_PER_GAME,
    finishAnimationMs: CRUSHER_ESCALATOR.FINISH_ANIMATION_MS,
    createRoundData: (context) => createRoundData(context),
    parseResult: (raw) => parseCrusherEscalatorResult(raw),
    parseProgress: (raw) => parseCrusherEscalatorProgress(raw),
    resultTimeoutMs,
    rank,
    shouldCloseEarly
};
