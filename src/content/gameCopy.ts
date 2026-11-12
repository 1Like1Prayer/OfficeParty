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
      'A target lands, then the clock runs. Stop it as close to the target as you can — closest wins, and hundredths are the margin.',
  },
  'cube-counter': {
    input: 'Keypad',
    length: '45s',
    rules:
      'A pile of blocks flashes up, then vanishes. Type how many you saw. Wide blocks count once, and the flashes get shorter. Most right wins; speed breaks ties.',
  },
  'crusher-escalator': {
    input: 'Arrow keys',
    length: '1 min',
    rules:
      'Everyone runs up their own escalator. Press the arrow that is showing — every press moves on to the next one. Fall 8 points behind the leader and you slip into the black hole. Last one running wins.',
  },
  'type-racer-roulette': {
    input: 'Keyboard',
    length: '3 min',
    rules:
      'Everyone types the same paragraphs on an old typewriter, perched on a board over the sea. A wrong key sends you back to the start of the line and costs a strike. Three strikes roll the dice: a skull and your block crumbles. Run out of time on a paragraph and it crumbles too. First to finish wins.',
  },
  'log-dodge': {
    input: 'Arrow keys',
    length: '1 min',
    rules:
      'Everyone runs on one giant treadmill out over the sea while logs roll in along the deck — some at your feet, some at your head. Get over them or under them. Three hits and you’re thrown off the back. Last one standing wins.',
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
