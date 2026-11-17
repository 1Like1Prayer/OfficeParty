import { loopSound, sound } from '../core/sound.ts'

/** Log Dodge: the sea, logs rolling in, jumping and ducking, getting hit, and being thrown off. */
export const logDodge = {
  /** A log rolling in: a wooden rumble that grows. `isHigh` for a head-height log. */
  logRoll: (isHigh: boolean) => { logRollSound({ pitch: isHigh ? 1.35 : 1 }) },

  /** Jump: a quick upward hop. */
  jump: sound('games/logDodge/jump', { vary: 0.05 }),

  /** Duck: a downward swish. */
  duck: sound('games/logDodge/duck', { vary: 0.05 }),

  /** Hit by a log: a wooden bonk and an oof. */
  hit: sound('games/logDodge/hit', { duck: { depth: 0.25, holdMs: 300 } }),

  /** A life gone, on the HUD: a falling pair of blips. */
  lifeLost: sound('games/logDodge/lifeLost'),

  /** Thrown off the back: a falling whistle and a splash. */
  knockedOut: sound('games/logDodge/knockedOut', { duck: { depth: 0.5, holdMs: 1500 } }),

  /** Last one standing. */
  win: sound('games/logDodge/win', { duck: { depth: 0.4, holdMs: 900 } }),

  /** Waves round the treadmill, out over the sea (ambience). */
  seaLoop: loopSound('shared/ambience/sea', 'ambience'),
} as const

const logRollSound = sound('games/logDodge/logRoll', { gate: 'ld.roll', minGapMs: 150, vary: 0.05 })
