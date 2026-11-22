/**
 * Skribbl tunables. Shared, because the client needs the canvas size, the
 * palette size and the settings bounds to render and validate honestly.
 */

/** What the owner can change in the lobby: bounds and defaults. */
export const SKRIBBL_SETTINGS = {
    ROUNDS: { min: 1, max: 10, default: 3 },
    DRAW_TIME_SEC: { min: 30, max: 90, step: 15, default: 60 },
    /** How many words the drawer picks from. */
    WORD_CHOICES: { min: 1, max: 5, default: 3 },
    /** Letters revealed over a turn (fewer for short words; see hints.ts). */
    HINTS: { min: 0, max: 5, default: 2 }
} as const;

export const SKRIBBL_TIMING = {
    /** The drawer has this long to pick a word, or one is picked for them. */
    CHOOSE_MS: 15_000,
    /** The word and the turn's points stay up this long. */
    REVEAL_MS: 5_000,
    /** The final scores show this long before the room returns to the lobby. */
    PODIUM_MS: 12_000,
    /**
     * A drawer whose connection drops gets this long to come back before the
     * turn is given up. The turn's own timer keeps running meanwhile.
     */
    DRAWER_GRACE_MS: 10_000
} as const;

/**
 * Every client draws on a canvas of this fixed size and scales the bitmap to
 * the screen, so a flood fill covers the same pixels everywhere.
 */
export const CANVAS = {
    WIDTH: 800,
    HEIGHT: 600,
    /** Colors are indexes into a palette the client owns; this is its size. */
    PALETTE_SIZE: 26,
    /** Brush sizes are indexes too: 0 (finest) up to BRUSH_SIZES - 1. */
    BRUSH_SIZES: 5,
    /** Biggest draw message the server accepts (bytes). The drawer batches at ~20 Hz, well under this. */
    MAX_PACKET_BYTES: 8_192,
    /** Per turn: a drawing beyond this is refused, so one turn can't grow without bound. */
    MAX_ACTIONS: 3_000,
    MAX_POINTS: 60_000
} as const;

export const SKRIBBL_CHAT = {
    MAX_LENGTH: 100,
    /** Minimum gap between two chat messages from one player. */
    MIN_INTERVAL_MS: 250
} as const;

/**
 * Self-protection, as in the party room. The drawer sends ~20 draw batches a
 * second, plus chat and clock pings.
 */
export const SKRIBBL_MAX_MESSAGES_PER_SECOND = 60;
