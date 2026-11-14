/**
 * Crusher Escalator tunables. Everything a designer might adjust while
 * playtesting lives here, so the rules code contains no magic numbers.
 */

export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

export const CRUSHER_ESCALATOR = {
    /** Two scoring rounds per game; each race decides one point. */
    ROUNDS_PER_GAME: 2,

    /** Every player starts the race on this many points. */
    STARTING_SCORE: 0,
    /** Points awarded for pressing the arrow that is currently showing. */
    POINTS_PER_CORRECT_INPUT: 1,

    /**
     * A player is crushed when the leader (highest score) is this many points
     * ahead of them. The gap starts wide and narrows as the race goes on, so
     * evenly matched players can't stall until the time cap:
     *
     *   0-20 s: 8, 20 s: 7, 30 s: 6, 40 s: 5, 50 s: 4, 60 s onwards: 3.
     */
    ELIMINATION_GAP_START: 8,
    ELIMINATION_GAP_MIN: 3,
    /** The gap holds at its start value until this point in the race. */
    GAP_SHRINK_STARTS_MS: 20_000,
    /** From then on it narrows by one point this often, down to the minimum. */
    GAP_SHRINK_EVERY_MS: 10_000,

    /**
     * Breathing room after the race is decided (one player left) for the
     * ending animations, before the next round is scheduled.
     */
    FINISH_ANIMATION_MS: 4_000,

    /** The race ends at this time even if several players are still alive. */
    MAX_RACE_MS: 90_000,
    /** Extra wait for stragglers before the server scores without them. */
    RESULT_GRACE_MS: 5_000,
    /**
     * Upper bound on inputs in one result. Bounds the message size; far above
     * what a person can press in MAX_RACE_MS.
     */
    MAX_INPUTS: 2_000,
    /**
     * The fastest the server lets presses come (20 a second). Presses reported
     * closer together are spaced out to this, so a burst stamped at a single
     * instant plays out at a human rate instead of scoring all at once. Real
     * play never gets near it; clients should still ignore key auto-repeat.
     */
    MIN_PRESS_INTERVAL_MS: 50
} as const;
