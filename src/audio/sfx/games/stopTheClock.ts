import { sound } from '../core/sound.ts'

/** Stop the Clock: the target roll, the running stopwatch, the stop, and how close it was. */
export const stopTheClock = {
  /** One number flicking past in the target roll: a slot-machine clack. */
  rollClack: sound('games/stopTheClock/rollClack', { vary: 0.06, gate: 'stc.roll', minGapMs: 60 }),

  /** The roll landing on the real target: a heavy clunk and a bell. */
  rollLand: sound('games/stopTheClock/rollLand'),

  /** The stopwatch running: tick and tock alternate. */
  tick: (isTock: boolean) => { tickSound({ pitch: isTock ? 0.8 : 1 }) },

  /** STOP: a hard mechanical click. */
  stop: sound('games/stopTheClock/stop'),

  /** Someone else locked in: a quiet blip. */
  otherLockedIn: sound('games/stopTheClock/otherLockedIn', { gate: 'stc.other', minGapMs: 120, vary: 0.05 }),

  /** Closest of anyone to the target: a bright bullseye ding. */
  bullseye: sound('games/stopTheClock/bullseye'),

  /** Furthest off: a deflating womp. */
  womp: sound('games/stopTheClock/womp'),
} as const

const tickSound = sound('games/stopTheClock/tick')
