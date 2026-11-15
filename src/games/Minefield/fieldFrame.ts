import type { MinefieldMap } from '../../shared/games/minefield/types.ts'

/**
 * How many world units one tile is drawn as. The field itself already gets a
 * row wider per player, so this only spreads a crowded room a little further,
 * to keep a dozen name tags on the start line apart.
 */
export const tileScaleFor = (playerCount: number): number =>
  Math.min(1.5, Math.max(1, 1 + (playerCount - 4) * 0.06))

export interface Racer {
  playerId: string
  /**
   * Position on the field, in tiles, at race time `atMs`. For this player it
   * is where their own run has got to; for a rival it is their latest report,
   * and the stage draws them a little in the past (see remoteTrack.ts).
   */
  x: number
  y: number
  atMs: number
  /**
   * Tiles per millisecond this player is moving at. The stage carries them on
   * by it until the next frame, so their motion is smooth at any refresh rate.
   * Rivals' speed comes from their reports, so it is 0 here.
   */
  vx: number
  vy: number
  isSelf: boolean
  state: 'racing' | 'exploding' | 'scanning' | 'out' | 'won'
  /** Blinks while the blast protection lasts. */
  isProtected: boolean
  lives: number
  /**
   * Which way this player is pointing the controls, on the field's axes (x
   * toward the finish, y across). The runner turns to face it at once, moving
   * or not, and keeps facing it after a tap. Only known for this player; null
   * for rivals and before any direction is pressed, when facing follows movement.
   */
  facing?: { x: number; y: number } | null
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
