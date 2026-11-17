import { loopSound, sound } from '../core/sound.ts'

/** Mage Battle: casting, fizzling, the beams' clash, and mages knocked out. */
export const mageBattle = {
  /** A spell landed for `points` (1–4): bigger and brighter the more it scored. */
  cast: (points: number, options: { volume?: number; gate?: string; minGapMs?: number } = {}) => {
    castSound({ ...options, pitch: 1 + (points - 1) * 0.12, volume: (0.7 + points * 0.1) * (options.volume ?? 1) })
    if (points >= 3) sparkleSound({ volume: options.volume ?? 1 })
  },

  /** A miss, or a spin gone by unpressed: the spell sputters. */
  fizzle: sound('games/mageBattle/fizzle', { vary: 0.06 }),

  /** A press this spin already had: a dud click. */
  spent: sound('games/mageBattle/spent', { gate: 'mb.spent', minGapMs: 80 }),

  /** A mage's beam firing for the first time. */
  beamFire: sound('games/mageBattle/beamFire', { gate: 'mb.fire', minGapMs: 120, vary: 0.06 }),

  /** A mage knocked out: a magic shatter. */
  knockedOut: sound('games/mageBattle/knockedOut', { duck: { depth: 0.4, holdMs: 900 } }),

  /** Last mage standing. */
  win: sound('games/mageBattle/win', { duck: { depth: 0.5, holdMs: 1400 } }),

  /** The beams locked in the middle: an electric hum. Steer the level from the clash's power. */
  beamLoop: loopSound('games/mageBattle/beam'),

  /** Wind round the standing stones (ambience). */
  windLoop: loopSound('shared/ambience/wind', 'ambience'),
} as const

const castSound = sound('games/mageBattle/cast', { vary: 0.03 })

const sparkleSound = sound('games/mageBattle/sparkle')
