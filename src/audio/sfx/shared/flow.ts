import { sound } from '../core/sound.ts'

/**
 * The sounds every game shares: the run-up to a round, the count-in, the
 * screens changing, results, and the champion at the end of the night.
 */
export const flow = {
  /** A whole screen swiping over to the next: an airy whoosh. */
  whoosh: sound('shared/flow/whoosh', { vary: 0.08, gate: 'flow.whoosh', minGapMs: 300 }),

  /** The next game announced: a game-show "ta-da". */
  reveal: sound('shared/flow/reveal', { duck: { depth: 0.35, holdMs: 700 }, gate: 'flow.reveal', minGapMs: 800 }),

  /** A tiebreak: two ominous low hits. */
  tiebreak: sound('shared/flow/tiebreak', { duck: { depth: 0.5, holdMs: 900 }, gate: 'flow.tiebreak', minGapMs: 800 }),

  /** "Game begins in 3, 2, 1": a woodblock tick, higher as it nears. `beat` is the number showing. */
  startsInTick: (beat: number) => {
    startsInTickSound({ pitch: 1 + (3 - Math.min(3, beat)) * 0.12 })
  },

  /** GET READY / SET: a game-show beep. `beat` is how many beats are left (3, 2). */
  cueBeep: (beat: number) => {
    cueBeepSound({ pitch: beat >= 3 ? 1 : 1.12 })
  },

  /** START!: a bright horn chord with a burst behind it. */
  go: sound('shared/flow/go', { duck: { depth: 0.4, holdMs: 500 }, gate: 'flow.go', minGapMs: 500 }),

  /** The TV intro's camera gliding in: a long swoosh. */
  swoosh: sound('shared/flow/swoosh', { gate: 'flow.swoosh', minGapMs: 1000 }),

  /** A screen switching on: a crackle and a hum. */
  tvOn: sound('shared/flow/tvOn', { gate: 'flow.tvOn', minGapMs: 500 }),

  /** Results coming in: a short snare roll that swells. */
  drumroll: sound('shared/flow/drumroll', { gate: 'flow.drumroll', minGapMs: 800 }),

  /** A round's results on screen: a cheerful sting. */
  resultsSting: sound('shared/flow/resultsSting', { gate: 'flow.sting', minGapMs: 800 }),

  /** The player's own row came first. */
  youWon: sound('shared/flow/youWon', { duck: { depth: 0.5, holdMs: 1100 }, gate: 'flow.sting', minGapMs: 800 }),

  /** Someone else won, or it went badly: a sad trombone. */
  youLost: sound('shared/flow/youLost', { duck: { depth: 0.4, holdMs: 1600 }, gate: 'flow.sting', minGapMs: 800 }),

  /** Points ticking onto the scoreboard: a coin. */
  scoreTick: sound('shared/flow/scoreTick', { gate: 'flow.score', minGapMs: 90 }),

  /** A player knocked out of a game, from anyone's game: a short falling blip. */
  eliminated: sound('shared/flow/eliminated', { gate: 'flow.eliminated', minGapMs: 150 }),

  /** The champion of the night: a brassy fanfare, with cymbals. */
  fanfare: sound('shared/flow/fanfare', { duck: { depth: 0.7, holdMs: 2600 }, gate: 'flow.fanfare', minGapMs: 2000 }),

  /** Confetti: a scatter of high sparkles. */
  confetti: sound('shared/flow/confetti', { gate: 'flow.confetti', minGapMs: 800 }),
} as const

const startsInTickSound = sound('shared/flow/startsInTick', { gate: 'flow.startsIn', minGapMs: 250 })

const cueBeepSound = sound('shared/flow/cueBeep', { duck: { depth: 0.25, holdMs: 300 }, gate: 'flow.cue', minGapMs: 250 })
