/**
 * Hex Drop tunables. Distances are in world units (a tile is about two and a
 * half across), times in milliseconds unless they say seconds.
 */

export const HEX_DROP = {
    ROUNDS_PER_GAME: 2,

    /* ---- the arena ---- */
    /** Centre to corner of one hexagonal tile. Tiles are pointy-topped. */
    TILE_RADIUS: 1.2,
    /** How thick a tile is drawn. Only its top surface is solid. */
    TILE_THICKNESS: 0.35,
    /**
     * The top layer: the 12 tiles of a ring two tiles out from the middle,
     * pushed apart by this factor so there is a gap between neighbours that
     * can only be crossed with a jump.
     */
    TOP_RING: 2,
    TOP_SPREAD: 1.75,
    /** The layers under the top one: solid hexagons this many rings out, widest at the bottom. */
    LOWER_RINGS: [4, 5, 6],
    /** Height between one layer and the next. */
    LAYER_GAP: 7,

    /* ---- tiles ---- */
    /** A tile drops this long after someone first stands on it. */
    FALL_DELAY_MS: 2_000,
    /**
     * A touch reported later than this after it happened is treated as
     * happening this long ago, so a laggy or dishonest report cannot make a
     * tile fall in the past for everyone else.
     */
    MAX_TOUCH_LAG_MS: 1_000,
    /** ...and one stamped this far in the future is refused. */
    MAX_TOUCH_LEAD_MS: 500,

    /* ---- the runner ---- */
    /** Each browser moves its own runner in fixed steps of this length. */
    STEP_SECONDS: 1 / 60,
    RUN_SPEED: 6,
    GROUND_ACCEL: 45,
    AIR_ACCEL: 20,
    JUMP_SPEED: 9,
    GRAVITY: 26,
    MAX_FALL_SPEED: 30,
    /** A jump still works this long after walking off an edge. */
    COYOTE_SECONDS: 0.1,
    /** A jump pressed this long before landing happens on landing. */
    JUMP_BUFFER_SECONDS: 0.12,
    /** The runner stays up when their middle is this far past a tile's edge. */
    FOOT_GRACE: 0.15,
    /** Falling this far below the bottom layer is out. */
    OUT_DEPTH: 8,

    /* ---- the round ---- */
    /** Positions are shared this often, so the others can be drawn moving smoothly. */
    PROGRESS_HZ: 20,
    /** The round ends by this time even if more than one runner is still up. */
    MAX_ROUND_MS: 180_000,
    RESULT_GRACE_MS: 5_000,
    FINISH_ANIMATION_MS: 4_000
} as const;
