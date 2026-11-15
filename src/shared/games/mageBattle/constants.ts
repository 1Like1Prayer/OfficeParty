/**
 * Mage Battle tunables. Angles are in degrees, times in milliseconds.
 */

export const MAGE_BATTLE = {
    ROUNDS_PER_GAME: 2,

    /* ---- the round ---- */
    /** The round ends this long after the start: the highest score wins. */
    ROUND_MS: 60_000,
    /** Fall this many points behind the leader and you are out. */
    ELIMINATION_GAP: 7,
    RESULT_GRACE_MS: 5_000,
    FINISH_ANIMATION_MS: 3_000,

    /* ---- the dial ---- */
    /** How fast the dial turns at the starting speed (one turn every two seconds). */
    BASE_DEG_PER_SEC: 180,
    /** Each speed level is this much faster than the starting speed. */
    SPEED_STEP: 0.1,
    /**
     * The fastest level: 140% of the starting speed. Levels 0..3 have 4..1
     * blocks; level 4 still has one block, so the last block speeds up twice.
     */
    MAX_LEVEL: 4,
    /** A miss at the fastest level drops back here (120%, two blocks). */
    MISS_AT_MAX_LEVEL_TO: 2,
    /**
     * The blocks, biggest first, in the order the dial reaches them. With fewer
     * than four on the ring, the biggest go first: the smallest are always left.
     */
    BLOCKS: [
        { points: 1, widthDeg: 40 },
        { points: 2, widthDeg: 28 },
        { points: 3, widthDeg: 18 },
        { points: 4, widthDeg: 10 }
    ],
    /**
     * Every spin the blocks move: they start this far round from the top (where
     * each spin starts), so there is always time to react, and they end before
     * the spin does.
     */
    ZONE_MIN_LEAD_DEG: 90,
    ZONE_MAX_LEAD_DEG: 240,

    /* ---- trusting the press times ---- */
    /**
     * A press reported later than this is taken as happening this long ago.
     * The dial is predictable, so this is also how far back a dishonest client
     * could pick a perfect moment: kept to the netcode guide's rewind cap.
     */
    MAX_PRESS_LAG_MS: 250,
    /** ...and one stamped further than this in the future is refused. */
    MAX_PRESS_LEAD_MS: 500
} as const;
