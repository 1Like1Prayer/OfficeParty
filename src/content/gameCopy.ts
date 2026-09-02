/**
 * Arena copy for each game. The server's catalog carries identity and kind;
 * how a game is described on the big screen is a presentation concern and
 * lives here so the wire contract stays free of prose.
 */

import type { GameId } from '../shared/games/catalog.ts'

export interface GameCopy {
  /** Controller verb shown on the reveal screen. */
  input: string
  /** Rough duration, e.g. "10s". */
  length: string
  rules: string
}

const FALLBACK: GameCopy = {
  input: 'Your phone',
  length: '1 min',
  rules: 'Check your phone. The controls change every game.',
}

const COPY: Partial<Record<GameId, GameCopy>> = {
  'stop-the-clock': {
    input: 'One tap',
    length: '10s',
    rules:
      'A target time appears. Start the clock, then stop it as close to the target as you can. Closest wins — and no, you cannot see the clock while it runs.',
  },
  'type-racer-roulette': {
    input: 'Keyboard',
    length: '45s',
    rules: 'Type the passage. One mistyped character and the round is somebody else’s.',
  },
  minefield: {
    input: 'Tilt + tap',
    length: '90s',
    rules: 'Cross the grid. Some tiles are mines. Everyone sees where you stepped.',
  },
  'liars-deck': {
    input: 'Tap',
    length: '3 min',
    rules: 'Play a card and claim what it is. Everyone else decides whether to believe you.',
  },
}

export function gameCopy(gameId: GameId): GameCopy {
  return COPY[gameId] ?? FALLBACK
}
