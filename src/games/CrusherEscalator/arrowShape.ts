import type { Direction } from '../../shared/games/crusherEscalator/types.ts'

/** The arrow prompt's look, shared by the game and its reveal-screen demo. */

export const CORRECT_COLOR = '#16B364'

export const ROTATION_DEGREES: Record<Direction, number> = { up: 0, right: 90, down: 180, left: 270 }

/** An up arrow's shape; the other directions are this, turned. */
export const ARROW_OUTLINE = '50,6 94,52 68,52 68,94 32,94 32,52 6,52'
