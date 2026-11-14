/**
 * Every number that shapes the arena. World units are roughly metres; a
 * runner is about 2.3 tall. Escalators climb away from the camera along +Y
 * and -Z, and the black hole sits below and in front of their lower ends.
 */


export const RAMP_ANGLE_RADIANS = (30 * Math.PI) / 180

export const LANE_WIDTH = 3.4
/** Wide enough that a name tag fits over each lane with room to spare. */
export const LANE_SPACING = 6
/** Runners are drawn larger than life-size to suit the wider escalators. */
export const RUNNER_SCALE = 1.3
export const RAMP_LENGTH = 34
/** The treads' pitch along the ramp, and how fast the steps ride downward. */
export const STEP_PITCH = 0.6
export const STEP_SPEED = 2.8

/** Distances along a ramp, measured up from its lower end. */
export const RUNNER_START_DISTANCE = 17
export const RUNNER_LOWEST_DISTANCE = 4.5
/** How quickly a runner drifts to the spot their gap puts them at. Low = slow. */
export const SLIP_RESPONSE_PER_SECOND = 1.1

/** No more lanes than this are ever drawn, so each one stays big enough to read. */
export const MAX_VISIBLE_LANES = 6
/**
 * How many lanes a screen shows: the player and their nearest neighbours. A
 * compact screen — upright, or a phone held sideways, too short to frame a
 * wide row big enough — has room for only a few before the tags collide.
 */
export const VISIBLE_LANES = { COMPACT: 3, FULL: MAX_VISIBLE_LANES } as const
export const COMPACT_SCREEN = '(orientation: portrait), (max-height: 520px)'
/** With fewer lanes the whole lane — escalator, runner, tag — grows, up to this. */
const MAX_LANE_SCALE = 1.8
export const laneScaleFor = (laneCount: number): number =>
  Math.min(MAX_LANE_SCALE, MAX_VISIBLE_LANES / Math.max(1, laneCount))

export const HOLE_DEPTH = -4.5

/** Where everything sits for a given number of lanes. */
export interface ArenaLayout {
  /** Lane centres, left to right. */
  slotXs: number[]
  laneScale: number
  /** The pit, sized to sit under the row of lanes. */
  hole: { radius: number; centerZ: number }
}

export function layoutFor(laneCount: number): ArenaLayout {
  const laneScale = laneScaleFor(laneCount)
  const rowWidth = laneCount * LANE_SPACING * laneScale
  const radius = Math.max(9, rowWidth / 2 + 4)
  return {
    slotXs: Array.from({ length: laneCount }, (_, index) => (index - (laneCount - 1) / 2) * LANE_SPACING * laneScale),
    laneScale,
    hole: { radius, centerZ: radius * 0.22 },
  }
}

/**
 * The changeover when the line-up changes (a tiebreaker among some of the
 * runners), as a script in seconds from the moment the new line-up is known.
 */
export const CHANGEOVER = {
  /** Lets the last of the crushed players start falling before anyone is lifted. */
  LIFT_DELAY: 0.9,
  /** The escalators slide into the new order while the runners are in the air. */
  RAMP_MOVE_DELAY: 1,
  RAMP_MOVE_DURATION: 1,
  /**
   * Escalators crossing paths weave: each lifts to its own height mid-slide, a
   * little more than an escalator is thick apart, so they pass over and under
   * one another instead of through.
   */
  WEAVE_SPACING: 2.2,
  /** Escalators for players who were not on screen rise out of the dark once the others have passed. */
  NEWCOMER_RISE_DELAY: 1.5,
  NEWCOMER_RISE_DURATION: 0.9,
  RISE_DEPTH: 32,
  /** Their runners are lowered onto them just after. */
  NEWCOMER_DROP_DELAY: 1.85,
  /** Escalators with nobody going on sink away, once their runner is gone or after this long. */
  LEAVER_SINK_DURATION: 0.8,
  LEAVER_MAX_WAIT: 1.4,
  /** Name tags are hidden for the whole changeover, then fade back in. */
  LABELS_RETURN_DELAY: 2.9,
  LABELS_FADE_DURATION: 0.5,
} as const

export const BACKGROUND_COLOR = 0x0a051c
export const CAMERA_FIELD_OF_VIEW = 52

/** When one lane arrives: its escalator rises, then its runner is lowered onto it. */
export interface ArrivalScript {
  riseDelay: number
  riseDuration: number
  dropDelay: number
  /** Name tags stay hidden until this long after the animation starts. */
  labelsReturnDelay: number
}

/** A lane that joins mid-changeover, once the others have passed. */
export const changeoverArrival = (): ArrivalScript => ({
  riseDelay: CHANGEOVER.NEWCOMER_RISE_DELAY,
  riseDuration: CHANGEOVER.NEWCOMER_RISE_DURATION,
  dropDelay: CHANGEOVER.NEWCOMER_DROP_DELAY,
  labelsReturnDelay: CHANGEOVER.LABELS_RETURN_DELAY,
})
