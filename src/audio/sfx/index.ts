/**
 * Sound effects. Every sound is a .wav under src/assets/audio/sfx/; the
 * modules here say how each one is played. Shared sounds (menus, the
 * count-in, results) live under `shared/`, each game's own under `games/`,
 * and the engine that plays them under `core/`. `recipes/` holds the synth
 * code the files were rendered from (a dev tool, never shipped). SOUNDS.md
 * maps every sound to where it is heard.
 *
 *   import { sfx } from '../audio/sfx'
 *   sfx.ui.click()
 *   sfx.typeRacer.key()
 */

import { crusherEscalator } from './games/crusherEscalator.ts'
import { cubeCounter } from './games/cubeCounter.ts'
import { hexDrop } from './games/hexDrop.ts'
import { logDodge } from './games/logDodge.ts'
import { mageBattle } from './games/mageBattle.ts'
import { minefield } from './games/minefield.ts'
import { stopTheClock } from './games/stopTheClock.ts'
import { typeRacer } from './games/typeRacer.ts'
import { ambience } from './shared/ambience.ts'
import { flow } from './shared/flow.ts'
import { ui } from './shared/ui.ts'

export const sfx = {
  ui,
  flow,
  ambience,
  stopTheClock,
  cubeCounter,
  crusherEscalator,
  typeRacer,
  logDodge,
  minefield,
  hexDrop,
  mageBattle,
} as const

export { sfxEngine } from './core/engine.ts'
export type { Channel, ChannelSettings, LoopSound, PlayOptions, SfxSettings } from './core/engine.ts'
export { useAmbientCalls, useLoop, useSfxSettings, useSoundOnChange } from './core/hooks.ts'
