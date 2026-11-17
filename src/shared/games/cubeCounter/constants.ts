/**
 * Cube Counter tunables. Everything a designer might want to adjust while
 * playtesting lives here, so the rules code contains no magic numbers.
 */

export const CUBE_COUNTER = {
    /** The floor is always a square grid of this many cells per side. */
    GRID_SIZE: 5,
    /** Boxes stack at most this many levels high (z = 0, 1, 2). */
    MAX_LEVELS: 3,
    /** A box's footprint is at most this many cells on each side. */
    MAX_FOOTPRINT_SIDE: 3,

    /**
     * One scoring round per game, made of this many consecutive puzzles, each
     * player going through them at their own pace on their own TV.
     */
    ROUNDS_PER_GAME: 1,
    PUZZLES_PER_ROUND: 8,
    /**
     * Shapes the difficulty ramp. Below 1 the ramp climbs quickly and then
     * levels off, so more of the round's puzzles sit at the hard end. 1 is a
     * straight line.
     */
    RAMP_CURVE_EXPONENT: 0.6,

    /**
     * The opening run-up, before the clock runs (the platform's default is
     * 7.5 s). Long enough for the intro to show everyone sitting round the TVs,
     * glide in to the player's own screen and count them in (the TVs' count-in
     * is 5.1 s, slower than the platform's 3.6 s), without rushing.
     */
    INTRO_COUNTDOWN_MS: 13_000,
    /** The round's final scores, on the TV, before the results screen. */
    FINISH_ANIMATION_MS: 8_000,

    /** How long every scene stays on screen, at every difficulty level. */
    FLASH_MS: 2_000,

    /** Number of boxes in a scene, from the first puzzle to the last. */
    EASIEST_BOX_COUNT: 3,
    HARDEST_BOX_COUNT: 14,
    /**
     * Hard puzzles pick their box count at random between this and
     * HARDEST_BOX_COUNT, so the hard end jumps around and any number can
     * come up again (see difficulty.ts).
     */
    HARD_BOX_COUNT_MIN: 9,
    /**
     * Where the hard puzzles start, as a fraction of the way through the
     * ramp. From here a puzzle gets a random box count and construction style.
     */
    HARD_FROM_PROGRESS: 0.5,

    /** Chance that a box is wider than 1x1, once big boxes are allowed. */
    EASIEST_BIG_BOX_CHANCE: 0.15,
    HARDEST_BIG_BOX_CHANCE: 0.5,

    /** Time the player has to type an answer once the scene is hidden. */
    ANSWER_LIMIT_MS: 10_000,
    /** After an answer, the scene comes back with whether it was right... */
    REVEAL_MS: 2_000,
    /** ...then "next puzzle" counts the player in: 3, 2, 1. */
    NEXT_PUZZLE_MS: 3_000,
    /** Everything between one puzzle's answer and the next flash: REVEAL_MS + NEXT_PUZZLE_MS. */
    PAUSE_BETWEEN_PUZZLES_MS: 5_000,
    /** Extra wait for stragglers before the server scores without them. */
    RESULT_GRACE_MS: 5_000,

    /**
     * Visibility rules (see visibility.ts). Fractions of a box's visible
     * surface that must be showing from the fixed camera.
     */
    MIN_BIG_BOX_VISIBLE_FRACTION: 0.6,
    MIN_SINGLE_BOX_VISIBLE_FRACTION: 0.25,

    /** Generator effort before it gives up and uses the fallback scene. */
    MAX_SCENE_ATTEMPTS: 200,
    MAX_PLACEMENT_TRIES_PER_BOX: 30
} as const;

/** The most boxes a scene could ever hold; the upper bound for any answer. */
export const MAX_POSSIBLE_BOX_COUNT =
    CUBE_COUNTER.GRID_SIZE * CUBE_COUNTER.GRID_SIZE * CUBE_COUNTER.MAX_LEVELS;
