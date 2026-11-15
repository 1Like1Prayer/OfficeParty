/** The public round data. Everything else lives in the shared world. */
export interface MageBattleRound {
    /** Seeds where each player's blocks appear. Public: knowing it does not help much. */
    seed: number;
    /** Everyone fighting this attempt. */
    playerIds: string[];
}

/**
 * One mage's dial during its current spin. Every spin is one full turn,
 * starting at the top; where the dial is at any moment of it follows from
 * this (see `angleAt`).
 */
export interface Dial {
    /** 0 is the starting speed; each level is 10% faster. Also sets how many blocks are up. */
    level: number;
    /** When this spin started, in ms from the start of the round. */
    sinceMs: number;
    /** How far round from the top the first block starts, this spin. */
    zone: number;
    /** Which spin this is, from 0; picks where the blocks go. */
    spin: number;
    score: number;
    /**
     * What the press this spin scored (0 is a miss), or null if they have not
     * pressed yet. Only the first press in a spin counts.
     */
    pressPoints: number | null;
    /** When they pressed this spin, or null. */
    pressedAtMs: number | null;
    /** When they fell too far behind, or null while still fighting. */
    outAtMs: number | null;
}

export interface PressAction {
    type: 'press';
    /** When the player pressed, in ms from the start. */
    atMs: number;
}

/** The server's answer to a press. */
export interface PressReply {
    /** False if they had already pressed this spin (or are out): the press changed nothing. */
    counted: boolean;
    points: number;
    /** Their dial, as the server has it now. */
    dial: Dial;
    /** Anyone this press knocked out. */
    eliminated: string[];
}

export interface MageBattleResult {
    /** The tab was backgrounded mid-round, so local timing may be off. */
    timingSuspect: boolean;
}
