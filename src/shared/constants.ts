/**
 * Platform-wide tunables. They live in shared/ because the client needs
 * several of them to render honestly (how long a ready check waits, how long
 * results stay up, how often to ping).
 */

/** Bumped whenever a message or state shape changes. Mismatched clients are asked to reload. */
export const PROTOCOL_VERSION = 16;

/**
 * Avatars are chosen by the player and drawn from a seed, never a URL. The
 * client turns the seed into an image; the server only ever stores an opaque
 * token, so nobody can make the rest of the room fetch an address they picked.
 */
export const AVATAR = {
    /** Seeds are compared and stored as-is, so keep the alphabet boring. */
    SEED_PATTERN: /^[A-Za-z0-9_-]{1,32}$/,
    /**
     * Only a guard against absurd payloads. Anything longer than a seed is
     * still rejected by SEED_PATTERN and replaced, rather than refusing the
     * join over a picture.
     */
    MAX_PAYLOAD_LENGTH: 256
} as const;

export const ROOM = {
    /** Room codes are 4 characters from an unambiguous alphabet (no 0/O, 1/I). */
    CODE_LENGTH: 4,
    CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 12,
    /** Name length bound, so a runaway client cannot post a novel. */
    MAX_NAME_LENGTH: 24,
    /** A dropped player keeps their slot this long (Colyseus `allowReconnection`). */
    DISCONNECT_GRACE_SECONDS: 30,
    /**
     * Self-protection: several rooms share one process, so a runaway browser
     * loop is disconnected rather than allowed to starve the room next to it.
     * Normal play peaks around 10 messages a second (progress + pings).
     */
    MAX_MESSAGES_PER_SECOND: 40
} as const;

export const COMPETITION = {
    /*
     * How many scoring rounds a game gets is the game's own business: each
     * game module declares `roundsPerGame`. Each scoring round is worth one point.
     */
    /** How many games random mode picks (capped by how many are implemented). */
    RANDOM_PLAYLIST_SIZE: 5,
    MAX_CUSTOM_PLAYLIST_SIZE: 9,
    /** How long the results screen shows before the next round starts. */
    RESULT_DISPLAY_MS: 6_000,
    /** How long the final leaderboard shows before the room returns to lobby. */
    LEADERBOARD_DISPLAY_MS: 15_000
} as const;

export const SELF_TIMED = {
    /**
     * How far ahead a start is scheduled once everyone is ready. Long enough to
     * absorb normal latency and the state patch interval, short enough not to
     * feel like a stall.
     */
    START_LEAD_MS: 4_500,
    /**
     * If someone never acknowledges the ready check we start without them
     * rather than hanging the room.
     */
    READY_CHECK_TIMEOUT_MS: 20_000,
    /**
     * The window the round owns before the clock runs, and which the server
     * does not count against anyone: the game builds up in the first part of
     * it and the last part is the "get ready, set, start!" the client counts down.
     */
    COUNTDOWN_MS: 7_500,
    /** Clients send progress at roughly this rate, purely for display. */
    PROGRESS_HZ: 5,
    /** Server-side floor on the gap between progress updates from one player. */
    PROGRESS_MIN_INTERVAL_MS: 120,
    /**
     * Once a game says the round is decided (see `shouldCloseEarly`), players
     * who haven't reported get this long to stop and send their result.
     */
    CLOSING_GRACE_MS: 5_000,
    /** A scoring round runs at most this many tiebreakers before coin-flipping. */
    MAX_TIEBREAK_ATTEMPTS: 3,
    /** How long the "it's a tie" screen shows before the tiebreaker loads. */
    TIEBREAK_DELAY_MS: 4_000
} as const;

/**
 * Clock sync (Cristian's algorithm, netcode guide section 2). The server time
 * is only ever used to turn a scheduled server instant into a local one for
 * countdowns and animations; it never touches a reported result.
 */
export const CLOCK_SYNC = {
    /** Pings sent back to back right after joining, so the first estimate is good. */
    BURST_SIZE: 5,
    BURST_INTERVAL_MS: 100,
    /** Steady-state re-sync cadence. */
    INTERVAL_MS: 2_000,
    /** How many recent samples to keep; the lowest round trip among them wins. */
    SAMPLE_WINDOW: 16,
    /** The estimate eases toward a new offset at most this fast (5 % of elapsed time). */
    MAX_SLEW_RATE: 0.05,
    /** Errors larger than this are a real jump (sleep, tab freeze): snap instead of easing. */
    SNAP_THRESHOLD_MS: 250
} as const;
