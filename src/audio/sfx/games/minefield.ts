import { sound } from '../core/sound.ts'

/** Minefield: footsteps, sonar, mines going off, and the finish line. */
export const minefield = {
  /** A footstep on sand. */
  footstep: sound('games/minefield/footstep', { vary: 0.15 }),

  /** A sonar pulse: a submarine ping and its echo. Played for anyone's scan, quieter the further off. */
  sonar: sound('games/minefield/sonar', { gate: 'mf.sonar', minGapMs: 120 }),

  /** The sonar is charged again. */
  sonarReady: sound('games/minefield/sonarReady'),

  /** A mine found by a scan, popping up out of the sand. */
  mineRevealed: sound('games/minefield/mineRevealed', { gate: 'mf.reveal', minGapMs: 50, vary: 0.1 }),

  /** A mine going off: a boom with a long tail. Quieter the further off. */
  explosion: sound('games/minefield/explosion', { gate: 'mf.boom', minGapMs: 80, vary: 0.08 }),

  /** Ringing ears after a blast right beside the player. */
  earRing: sound('games/minefield/earRing'),

  /** Blown up the second time: out of the race. */
  out: sound('games/minefield/out', { duck: { depth: 0.6, holdMs: 1800 } }),

  /** Across the finish line: a referee's whistle. */
  finish: sound('games/minefield/finish', { duck: { depth: 0.5, holdMs: 1200 } }),
} as const
