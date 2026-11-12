import type { MinefieldMap } from '../../shared/games/minefield/types.ts'

/**
 * How many world units one tile is drawn as. The field is always the same
 * number of tiles, but a crowded room spreads it out: each tile takes more
 * room, so a dozen runners have space to run, and their name tags stay apart.
 */
export const tileScaleFor = (playerCount: number): number =>
  Math.min(2.2, Math.max(1, 1 + (playerCount - 4) * 0.15))

export interface Racer {
  playerId: string
  /** Position on the field, in tiles. */
  x: number
  y: number
  isSelf: boolean
  state: 'racing' | 'exploding' | 'scanning' | 'out' | 'won'
  /** Blinks while the blast protection lasts. */
  isProtected: boolean
  lives: number
}

export interface Blast {
  x: number
  y: number
  atMs: number
}

export interface ScanPulse {
  x: number
  y: number
  atMs: number
}

/** Everything the stage draws, as of this render. Times are ms into the round. */
export interface FieldFrame {
  map: MinefieldMap
  racers: readonly Racer[]
  /** Mines showing right now, as indices into the map's mines. */
  revealed: readonly number[]
  /** Mines that have already gone off, for anyone. */
  gone: readonly number[]
  blasts: readonly Blast[]
  scans: readonly ScanPulse[]
  /** The race has been decided: the camera pulls back to take it all in. */
  isRaceOver: boolean
}
