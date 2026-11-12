/**
 * Every number that shapes the Log Dodge stage. World units are roughly
 * metres; a contestant is about 1.8 tall. They run toward -Z on a belt that
 * carries the floor toward +Z (the camera), and the logs roll in from the
 * haze at -Z.
 */

import type { LogHeight } from '../../../shared/games/logDodge/types.ts'

/** The haze at the horizon, which the fog, the sky and the far sea all fade to. */
export const HORIZON_COLOR = '#cfeeff'
export const SKY_TOP_COLOR = '#3c9df0'
export const SEA_COLOR = '#1597d3'
/** Where the sea sits, below the deck. */
export const SEA_LEVEL = -3.2
export const CAMERA_FIELD_OF_VIEW = 52

/** More contestants than this are still playing; they just are not drawn. */
export const MAX_VISIBLE_CONTESTANTS = 12
export const LANE_SPACING = 2.5
/** Bare belt either side of the outermost lane. */
export const BELT_MARGIN = 2.2

export const BELT = {
  /** The belt's near end (under the camera) and far end (lost in the fog). */
  NEAR_Z: 12,
  FAR_Z: -120,
  /** How fast the surface rolls toward the camera, in units a second. */
  SPEED: 9,
  /** The pitch of the stripes drawn on it. */
  STRIPE_PITCH: 2.4,
} as const

/**
 * Logs start this far down the deck and roll to the contestants at z = 0.
 * Their speed follows from how long each is visible, so a short warning means
 * a fast log.
 */
export const LOG = {
  SPAWN_Z: -78,
  GONE_Z: 20,
  /** The length the shared trunk geometry is built at; each log is stretched to span its deck. */
  LENGTH: 10,
  /** How far a log stops short of the belt's edge at each end, so it sits wholly on the running surface. */
  INSET: 0.45,
  /** A steeply swung log is stretched no further than this, so a near-edge-on one stays sane. */
  MIN_COS_TILT: 0.3,
  /** Fraction of the approach over which a log fades in out of the haze. */
  FADE_IN: 0.1,
} as const

/** Where each log hangs, to the middle of the trunk: along the deck, or at head height. */
export const LOG_HEIGHT: Record<LogHeight, number> = {
  low: 0.3,
  high: 1.78,
}

/** Thick enough to read as a log; the high one a little slimmer so a ducked head clears it. */
export const LOG_RADIUS: Record<LogHeight, number> = {
  low: 0.3,
  high: 0.26,
}

/** A log that has not been dodged this long after reaching a contestant has hit them. */
export const CONTACT_GRACE_MS = 120

/** The camera's two homes: above everyone, and behind the player. */
export const CAMERA = {
  /** How far the overview tilts back from straight down, as a share of its height. */
  OVERVIEW_TILT: 0.3,
  /** How much further back than a snug fit the overview starts, so the swoop has room to travel. */
  OVERVIEW_PULL_BACK: 1.3,
  /** The follow camera: well above and behind, looking down the belt, so the logs' direction reads. */
  FOLLOW_HEIGHT: 8,
  FOLLOW_BEHIND: 12,
  FOLLOW_LOOK_HEIGHT: 0.6,
  FOLLOW_LOOK_AHEAD: -7,
  /** How hard a hit rattles the camera, and how fast that dies away. */
  SHAKE_STRENGTH: 0.32,
  SHAKE_DECAY_PER_SECOND: 5,
} as const

/**
 * When the camera moves, in milliseconds from the moment the clock starts
 * (so negative). It holds on the overview, then swoops in on the player,
 * landing as the "get ready" cue begins so the player settles before play.
 */
export const ZOOM = {
  START_MS: -6300,
  END_MS: -3600,
} as const
