import { loopSound, sound } from '../core/sound.ts'

/** Crusher Escalator: climbing, missing, the black hole's hunger, and being swallowed. */
export const crusherEscalator = {
  /** A right arrow: a step thunk. `streak` nudges it up the scale as the run goes on. */
  step: (streak: number) => {
    stepSound({ pitch: 1 + Math.min(12, streak % 13) * 0.03 })
  },

  /** A wrong arrow: a metallic clank. */
  wrong: sound('games/crusherEscalator/wrong', { vary: 0.04 }),

  /** The elimination gap narrowing: a warning double pip. */
  gapNarrows: sound('games/crusherEscalator/gapNarrows'),

  /** Swallowed by the black hole: a long sucking dive into the dark. */
  swallowed: sound('games/crusherEscalator/swallowed', { duck: { depth: 0.5, holdMs: 1500 } }),

  /** The black hole's hum: louder and higher as anyone nears the edge. Steer level and pitch from the danger. */
  blackHoleLoop: loopSound('games/crusherEscalator/blackHole'),

  /** The escalator's machinery under it all (ambience). */
  escalatorLoop: loopSound('games/crusherEscalator/escalator', 'ambience'),
} as const

const stepSound = sound('games/crusherEscalator/step', { vary: 0.03 })
