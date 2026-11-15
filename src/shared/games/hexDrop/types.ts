/** One hexagonal tile of the arena. */
export interface Tile {
    /** Index into the arena's tile list, and the tile's key in the shared world. */
    id: number;
    /** 0 is the top layer. */
    layer: number;
    x: number;
    z: number;
}

/** The public round data. The arena itself is fixed, so only who starts where is sent. */
export interface HexDropRound {
    /** Each player's starting tile on the top layer, by player id. */
    spawns: Record<string, number>;
}

export interface HexDropResult {
    /** When the runner fell out, in ms from the start; null if they were still up. */
    outAtMs: number | null;
    /** The tab was backgrounded mid-round, so local timing may be off. */
    timingSuspect: boolean;
}

/** Sent each time the runner first stands on a tile. */
export interface TouchAction {
    type: 'touch';
    tile: number;
    atMs: number;
}

/** The server's answer: when that tile falls, for everyone. */
export interface TouchReply {
    tile: number;
    fallAtMs: number;
}
