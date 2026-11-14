/**
 * Type Racer Roulette as a self-timed game module.
 *
 * Each player types through the same paragraphs, line by line. A mistake
 * restarts the line and costs a strike; three strikes in a paragraph cast a
 * dice of hearts and skulls, and a skull knocks you out. Survive and the next
 * roll has one more skull. First to finish every paragraph wins; a paragraph
 * left unfinished after three minutes also knocks you out.
 *
 * The browser validates typing locally so every key press is instant, and
 * reports what happened with timestamps. The server replays it (see
 * replay.ts) and rolls the dice itself, so the outcome of a roll stays a
 * surprise: the client asks for it mid-race through `handleAction`.
 *
 * The die's randomness is injected (`rollFace`), because it needs a server
 * secret and this module is shared with the browser.
 *
 * Only the winner scores, so the round closes as soon as the server's replay
 * shows it is decided (see `shouldCloseEarly`), and each player's replayed
 * finish or knock-out is announced to the room (see `progressFromResult`).
 */

import { assignSharedRanks } from '../ranking.js';
import type { RandomSource } from '../random.js';
import type { RankedEntry, ResultEntry, SelfTimedGameModule } from '../selfTimed.js';
import { TYPE_RACER } from './constants.js';
import { describeRoll, skullsForRoll } from './dice.js';
import { parseRollAction, parseTypeRacerProgress, parseTypeRacerResult } from './parsing.js';
import { locateOnBar, totalCharacters } from './progress.js';
import {
    compareRuns,
    findLastSurvivor,
    isSameRun,
    replayRun,
    type PlayerRun,
    type PlayerRunEntry,
    type RunStatus
} from './replay.js';
import { createTypeRacerRound } from './roundData.js';
import type { DieRoll, RollFace, TypeRacerResult, TypeRacerRound } from './types.js';

/** The longest the race can take: every paragraph run to its limit, with every pause. */
const resultTimeoutMs = (round: TypeRacerRound): number => {
    const pauses = round.paragraphs.length - 1;
    return (
        round.paragraphs.length * TYPE_RACER.PARAGRAPH_TIME_LIMIT_MS +
        pauses * TYPE_RACER.PARAGRAPH_PAUSE_MS +
        TYPE_RACER.RESULT_GRACE_MS
    );
};

export const createTypeRacerModule = (
    rollFace: RollFace,
    random: RandomSource = Math.random
): SelfTimedGameModule<TypeRacerRound, TypeRacerResult> => {
    /**
     * `raceEndedAtMs` cuts the replay short for the last survivor: once every
     * other player is out the race is over, so nothing they did afterwards counts.
     */
    const runOf = (
        playerId: string,
        result: TypeRacerResult,
        round: TypeRacerRound,
        raceEndedAtMs = Number.POSITIVE_INFINITY
    ): PlayerRun =>
        replayRun(
            result.events.filter((event) => event.atMs <= raceEndedAtMs),
            Math.min(result.endedAtMs, raceEndedAtMs),
            round.paragraphs,
            (rollIndex) => rollFace(round.rollNonce, playerId, rollIndex)
        );

    const rank = (
        entries: ResultEntry<TypeRacerResult>[],
        round: TypeRacerRound
    ): RankedEntry[] => {
        const fullRuns: PlayerRunEntry[] = entries.map(({ playerId, result }) => ({
            playerId,
            run: runOf(playerId, result, round)
        }));

        // When everyone else has been knocked out, the one left standing wins.
        const lastSurvivor = findLastSurvivor(fullRuns);
        const isLastSurvivor = (playerId: string): boolean => lastSurvivor?.playerId === playerId;

        const scored = entries
            .map(({ playerId, result }) => ({
                playerId,
                timingSuspect: result.timingSuspect,
                lastSurvivor: isLastSurvivor(playerId),
                run:
                    lastSurvivor !== null && isLastSurvivor(playerId)
                        ? runOf(playerId, result, round, lastSurvivor.wonAtMs)
                        : fullRuns.find((entry) => entry.playerId === playerId)!.run
            }))
            .sort(
                (a, b) =>
                    Number(b.lastSurvivor) - Number(a.lastSurvivor) ||
                    compareRuns(a.run, b.run) ||
                    a.playerId.localeCompare(b.playerId)
            );

        // The last survivor wins outright; it can't tie with anyone.
        const isTie = (a: (typeof scored)[number], b: (typeof scored)[number]): boolean =>
            !a.lastSurvivor && !b.lastSurvivor && isSameRun(a.run, b.run);

        return assignSharedRanks(scored, isTie).map(
            ({ item, rank: position }) => ({
                playerId: item.playerId,
                rank: position,
                reported: true,
                detail: {
                    status: item.run.status,
                    endedAtMs: item.run.endedAtMs,
                    paragraphsDone: item.run.paragraphsDone,
                    paragraphCount: round.paragraphs.length,
                    linesDone: item.run.linesDone,
                    charsDone: item.run.charsDone,
                    totalChars: totalCharacters(round.paragraphs),
                    barFraction: locateOnBar(round.paragraphs, item.run.charsDone).fractionOfBar,
                    rollsCast: item.run.rollsCast,
                    ...(item.run.cause !== null && { eliminatedBy: item.run.cause }),
                    lastSurvivor: item.lastSurvivor,
                    timingSuspect: item.timingSuspect
                }
            })
        );
    };

    /**
     * The race is decided, so the players still typing are told to stop and
     * report, once either:
     *  - someone's replay shows they finished every paragraph: only the winner
     *    scores, and anyone who finished sooner would already have reported; or
     *  - everyone but one player has reported, and every one of them was
     *    knocked out: the one left is the last survivor.
     * A player who merely dropped out is not counted as knocked out, so a brief
     * disconnect never ends the race for everyone else.
     */
    const shouldCloseEarly = (
        reported: readonly ResultEntry<TypeRacerResult>[],
        participantCount: number,
        round: TypeRacerRound
    ): boolean => {
        const statuses = reported.map(({ playerId, result }) => runOf(playerId, result, round).status);
        if (statuses.includes('finished')) return true;
        return (
            reported.length >= 1 &&
            participantCount - reported.length <= 1 &&
            statuses.every((status) => status === 'eliminated')
        );
    };

    /**
     * When a player's result comes in, tell the room how their race ended,
     * straight from the replay. Everyone sees a finish or a knock-out even if
     * that player's own progress messages were lost or never sent, which is
     * what lets the last player standing know they have won. Shaped like a
     * progress report: chars, paragraph, strikes, skulls, status.
     */
    const STATUS_CODE: Partial<Record<RunStatus, number>> = { finished: 1, eliminated: 2 };
    const progressFromResult = (
        result: TypeRacerResult,
        round: TypeRacerRound,
        playerId: string
    ): Record<string, number> | null => {
        const run = runOf(playerId, result, round);
        const status = STATUS_CODE[run.status];
        // A player who simply stopped (the race was closed on them) says nothing new.
        if (status === undefined) return null;
        return {
            chars: run.charsDone,
            paragraph: Math.min(run.paragraphsDone, round.paragraphs.length),
            // A skull comes on a third strike; the clock can run out on any number.
            strikes: run.cause === 'skull' ? TYPE_RACER.STRIKES_TO_ROLL : 0,
            skulls: skullsForRoll(run.rollsCast),
            status
        };
    };

    /** The player asks for the outcome of a dice roll. */
    const handleAction = (
        round: TypeRacerRound,
        playerId: string,
        raw: unknown
    ): DieRoll | null => {
        const action = parseRollAction(raw);
        if (action === null) return null;
        return describeRoll(rollFace(round.rollNonce, playerId, action.rollIndex), action.rollIndex);
    };

    return {
        id: 'type-racer-roulette',
        title: 'Type Racer Roulette',
        kind: 'self-timed',
        roundsPerGame: TYPE_RACER.ROUNDS_PER_GAME,
        finishAnimationMs: TYPE_RACER.FINISH_ANIMATION_MS,
        createRoundData: () => createTypeRacerRound(random),
        parseResult: (raw) => parseTypeRacerResult(raw),
        parseProgress: (raw, round) => parseTypeRacerProgress(raw, round),
        resultTimeoutMs,
        rank,
        handleAction,
        shouldCloseEarly,
        progressFromResult
    };
};
