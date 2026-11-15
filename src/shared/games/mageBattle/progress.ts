/**
 * The battle bar: how far ahead or behind each mage is.
 *
 * One bar shows every mage, like Type Racer's race bar, but it measures the
 * gap to the leader rather than distance run. Its right end is the leader's
 * score and its left end is the knock-out line, ELIMINATION_GAP points below
 * it. Every point is one equal section, with a checkpoint between each, so a
 * mage's marker sits one section further left for every point they trail by.
 * As the leader scores, the whole window slides up and everyone behind slides
 * left; reach the left end and you are out.
 *
 * Both the client (to draw the bar) and the server (to decide knock-outs) use
 * these functions, so a marker reaching the line and the knock-out are always
 * the same event. Plain functions over plain data.
 */

import { MAGE_BATTLE } from './constants.js';

export interface Standing {
    playerId: string;
    score: number;
    /** Knocked out: their score is frozen and they no longer set the leader's mark. */
    out: boolean;
}

export interface BarMarker {
    playerId: string;
    score: number;
    out: boolean;
    /** Where on the bar, 0 (the knock-out line) to 1 (level with the leader). */
    fractionOfBar: number;
    /** Points behind the leader. 0 for the leader, and for anyone level with them. */
    behindLeader: number;
    /**
     * Their score against the best of everyone else still fighting: ahead by
     * this much if positive, behind if negative. The leader sees their lead.
     */
    margin: number;
    /** Points they can still fall behind by before they are out. 0 means out. */
    pointsToKnockout: number;
}

export interface BattleBar {
    /** The best score among those still fighting: the bar's right end. */
    leaderScore: number;
    /** The bar's left end: a mage this low or lower is out. */
    knockoutScore: number;
    /** Between each point's section, as fractions, left to right. */
    checkpoints: number[];
    /** One per mage, best first. */
    markers: BarMarker[];
}

const GAP = MAGE_BATTLE.ELIMINATION_GAP;

/** Where the checkpoints sit: one between every two points of the gap. */
export const checkpointFractions = (): number[] =>
    Array.from({ length: GAP - 1 }, (_, index) => (index + 1) / GAP);

/** The best score among those still fighting (0 before anyone has scored). */
export const leaderScoreOf = (standings: readonly Standing[]): number =>
    Math.max(0, ...standings.filter(({ out }) => !out).map(({ score }) => score));

/** Who is ELIMINATION_GAP or more behind the leader and not yet out. */
export const dueForKnockout = (standings: readonly Standing[]): string[] => {
    const leader = leaderScoreOf(standings);
    return standings.filter(({ out, score }) => !out && leader - score >= GAP).map(({ playerId }) => playerId);
};

export const battleBar = (standings: readonly Standing[]): BattleBar => {
    const leaderScore = leaderScoreOf(standings);
    const fighting = standings.filter(({ out }) => !out);
    const markers = standings.map(({ playerId, score, out }) => {
        const behindLeader = Math.max(0, leaderScore - score);
        const others = fighting.filter((other) => other.playerId !== playerId);
        // Alone (or last one standing): nobody to be ahead of or behind.
        const margin = others.length === 0 ? 0 : score - Math.max(...others.map((other) => other.score));
        return {
            playerId,
            score,
            out,
            fractionOfBar: out ? 0 : Math.max(0, (GAP - behindLeader) / GAP),
            behindLeader,
            margin,
            pointsToKnockout: out ? 0 : Math.max(0, GAP - behindLeader)
        };
    });
    markers.sort(
        (a, b) => Number(a.out) - Number(b.out) || b.score - a.score || a.playerId.localeCompare(b.playerId)
    );
    return { leaderScore, knockoutScore: leaderScore - GAP, checkpoints: checkpointFractions(), markers };
};
