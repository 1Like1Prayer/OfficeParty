import { sound } from '../core/sound.ts'

/** Hex Drop: glassy tiles, warnings, drops, jumps, landings, and the long fall out. */
export const hexDrop = {
  /** Stepping onto a fresh tile: a glassy tink. `layer` (0 top – 3 bottom) lowers it floor by floor. */
  tileTouch: (layer: number) => { tileTouchSound({ pitch: 1 - layer * 0.1 }) },

  /** The tile underfoot is about to go: a rattle. */
  tileWarning: sound('games/hexDrop/tileWarning'),

  /** A tile dropping away: a crumble. Played for every tile, so it is gated. */
  tileDrop: sound('games/hexDrop/tileDrop', { gate: 'hd.drop', minGapMs: 70, vary: 0.12 }),

  /** Jump: a springy boing. */
  jump: sound('games/hexDrop/jump', { vary: 0.05 }),

  /** Landing on a tile. `isHard` after dropping a floor. */
  land: (isHard: boolean) => { (isHard ? hardLandSound : softLandSound)() },

  /** Falling through a gap: a falling whistle. */
  falling: sound('games/hexDrop/falling', { gate: 'hd.fall', minGapMs: 500 }),

  /** Out through the bottom floor: a long falling scream of a whistle, fading away. */
  out: sound('games/hexDrop/out', { duck: { depth: 0.5, holdMs: 2000 } }),

  /** Someone else falling out. */
  rivalOut: sound('games/hexDrop/rivalOut', { gate: 'hd.rivalOut', minGapMs: 200 }),

  /** Last one standing. */
  win: sound('games/hexDrop/win', { duck: { depth: 0.4, holdMs: 1200 } }),
} as const

const tileTouchSound = sound('games/hexDrop/tileTouch', { vary: 0.06, gate: 'hd.touch', minGapMs: 40 })

const softLandSound = sound('games/hexDrop/landSoft', { vary: 0.08 })

const hardLandSound = sound('games/hexDrop/landHard', { vary: 0.06 })
