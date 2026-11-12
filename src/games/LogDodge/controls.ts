import type { Action } from '../../shared/games/logDodge/types.ts'

const ACTION_BY_KEY: Record<string, Action> = {
  arrowup: 'jump',
  w: 'jump',
  ' ': 'jump',
  arrowdown: 'duck',
  s: 'duck',
}

/** The move a key stands for, or null if it is not a game key. */
export const actionForKey = (key: string): Action | null =>
  ACTION_BY_KEY[key.toLowerCase()] ?? null

/** How each move is written on the small reminder at the foot of the screen. */
export const ACTION_INFO: Record<Action, { label: string; glyph: string }> = {
  jump: { label: 'jump', glyph: '↑' },
  duck: { label: 'duck', glyph: '↓' },
}

/** The order the keys sit in on the keyboard: up and down. */
export const ACTION_ORDER: readonly Action[] = ['jump', 'duck']
