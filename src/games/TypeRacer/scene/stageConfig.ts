/**
 * Every number that shapes the stage. World units are roughly metres. Each
 * player sits on a board held up by one round wooden block standing in the
 * water; the boards form a ring, every player facing its middle.
 */

export const WATER_LEVEL = 0

/** Station layout, in the station's own frame: its origin is the board's top surface, forward is -Z. */
export const STATION = {
  BLOCK_RADIUS: 1.75,
  /** The block's full height; most of it is under water. */
  BLOCK_HEIGHT: 5,
  /** How high the board's top surface floats above the water. */
  BOARD_TOP_HEIGHT: 1.1,
  BOARD_WIDTH: 4.6,
  BOARD_DEPTH: 4.2,
  BOARD_THICKNESS: 0.24,
  TABLE_Z: -0.65,
  TABLE_WIDTH: 2.1,
  TABLE_DEPTH: 0.95,
  TABLE_HEIGHT: 0.5,
  /** Where the typist sits, and how high up their hands rest on the keys. */
  TYPIST_Z: 0.3,
  /** Where the die is thrown to, beside the table. */
  DIE_LANDING: { x: 1.65, z: -0.25 },
} as const

/** Boards need this much of the ring each, so neighbours never touch. */
const ARC_PER_STATION = 5.6
const MIN_RING_RADIUS = 6.5

export const ringRadius = (count: number): number =>
  Math.max(MIN_RING_RADIUS, ARC_PER_STATION / (2 * Math.sin(Math.PI / Math.max(2, count))))

export interface StationPose {
  x: number
  z: number
  /** Rotation about Y that turns the station's forward (-Z) toward the ring's middle. */
  yaw: number
  /** Position on the ring, in radians; this player's own is π/2, nearest the camera. */
  angle: number
}

/** Seats `count` stations round the ring, with `selfIndex` at the near side. */
export function stationPose(index: number, selfIndex: number, count: number): StationPose {
  const radius = ringRadius(count)
  const angle = Math.PI / 2 + ((index - selfIndex) * 2 * Math.PI) / count
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    yaw: Math.PI / 2 - angle,
    angle,
  }
}

export const SKY = {
  HORIZON: 0xf3a06b,
  ZENITH: 0x1a1740,
  SUN_DIRECTION: [-0.55, 0.2, -0.8] as const,
}

export const CAMERA = {
  FIELD_OF_VIEW: 50,
  /** How long the opening showcase takes, orbiting the ring before settling on the player. */
  SHOWCASE_SECONDS: 6.5,
  /** The camera's glide toward whichever pose it wants; higher = snappier. */
  FOLLOW_RATE: 2.4,
  /** Behind the player's board and above it, looking over their shoulder at the typewriter. */
  FOCUS_BEHIND: 6.6,
  FOCUS_HEIGHT: 4.4,
}
