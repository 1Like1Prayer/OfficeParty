import type { Direction } from '../../shared/games/crusherEscalator/types.ts'

const DIRECTION_BY_KEY: Record<string, Direction> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

/** The arrow a key stands for, or null if it is not a game key. */
export const directionForKey = (key: string): Direction | null =>
  DIRECTION_BY_KEY[key.toLowerCase()] ?? null

export const DIRECTION_GLYPH: Record<Direction, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
}
