import { loopSound, sound } from '../core/sound.ts'

/**
 * Type Racer Roulette: the typewriter, the dice, and the board giving way.
 * Rendered from synth recipes; a recorded typewriter (keys, bell, return)
 * dropped in under the same file names would sound far more real.
 */
export const typeRacer = {
  /** A correct key: a typewriter clack. */
  key: sound('games/typeRacer/key', { vary: 0.12, gate: 'tr.key', minGapMs: 22 }),

  /** A finished line: the carriage bell, then the return. */
  lineDone: sound('games/typeRacer/lineDone'),

  /** A wrong key: the typebars jam with a clunk, and a strike buzzer. */
  jam: sound('games/typeRacer/jam'),

  /** A fresh sheet: paper sliding in. */
  newSheet: sound('games/typeRacer/newSheet'),

  /** Three strikes: the die picked up and shaken in a cup. */
  diceShake: sound('games/typeRacer/diceShake'),

  /** The die thrown: a whoosh. */
  diceThrow: sound('games/typeRacer/diceThrow'),

  /** The die landing on wood: a few bounces. */
  diceLand: sound('games/typeRacer/diceLand'),

  /** A heart: relief, two notes up. */
  safe: sound('games/typeRacer/safe'),

  /** A skull: a doom gong. */
  skull: sound('games/typeRacer/skull', { duck: { depth: 0.6, holdMs: 1600 } }),

  /** The board under strain, at two strikes: a wooden creak. */
  creak: sound('games/typeRacer/creak', { vary: 0.1 }),

  /** The block crumbling: wood cracking and splintering. */
  crack: sound('games/typeRacer/crack'),

  /** Landing in the sea. */
  splash: sound('games/typeRacer/splash'),

  /** The paragraph's own clock in its last seconds: a tick. */
  timerTick: sound('games/typeRacer/timerTick'),

  /** Every paragraph typed / the race won: a fanfare. */
  win: sound('games/typeRacer/win', { duck: { depth: 0.5, holdMs: 1400 } }),

  /** Waves round the boards (ambience). */
  seaLoop: loopSound('shared/ambience/sea', 'ambience'),
} as const
