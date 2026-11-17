import { crusherEscalatorRecipes } from './games/crusherEscalator.ts'
import { cubeCounterRecipes } from './games/cubeCounter.ts'
import { hexDropRecipes } from './games/hexDrop.ts'
import { logDodgeRecipes } from './games/logDodge.ts'
import { mageBattleRecipes } from './games/mageBattle.ts'
import { minefieldRecipes } from './games/minefield.ts'
import { stopTheClockRecipes } from './games/stopTheClock.ts'
import { typeRacerRecipes } from './games/typeRacer.ts'
import { ambienceRecipes } from './shared/ambience.ts'
import { flowRecipes } from './shared/flow.ts'
import { uiRecipes } from './shared/ui.ts'
import type { Recipe, Recipes } from './types.ts'

/**
 * Every recipe, by the folder its .wav files are saved in under
 * src/assets/audio/sfx/ — `shared/ui/click` is saved as shared/ui/click.wav.
 * These are a dev tool: the game never imports them, only the files.
 */
const GROUPS: Record<string, Recipes> = {
  'shared/ui': uiRecipes,
  'shared/flow': flowRecipes,
  'shared/ambience': ambienceRecipes,
  'games/stopTheClock': stopTheClockRecipes,
  'games/cubeCounter': cubeCounterRecipes,
  'games/crusherEscalator': crusherEscalatorRecipes,
  'games/typeRacer': typeRacerRecipes,
  'games/logDodge': logDodgeRecipes,
  'games/minefield': minefieldRecipes,
  'games/hexDrop': hexDropRecipes,
  'games/mageBattle': mageBattleRecipes,
}

export const RECIPES: ReadonlyMap<string, Recipe> = new Map(
  Object.entries(GROUPS).flatMap(([folder, recipes]) =>
    Object.entries(recipes).map(([name, recipe]) => [`${folder}/${name}`, recipe] as const),
  ),
)
