import type { GameId } from '../shared/games/catalog.ts'

/**
 * Games this client can actually render a surface for. Kept beside the
 * dispatcher in `index.tsx` and must be updated with it — a game the server
 * will play but the client cannot draw would leave players staring at nothing.
 */
export function hasSurface(gameId: GameId): boolean {
  return (
    gameId === 'stop-the-clock' ||
    gameId === 'cube-counter' ||
    gameId === 'crusher-escalator'
  )
}

/**
 * Games that draw edge to edge. The play screen hands them the whole pane and
 * lays its title and countdown over the top instead of stacking them above.
 */
export function isFullBleed(gameId: GameId): boolean {
  return gameId === 'crusher-escalator'
}

/**
 * Games whose screen is worth watching without playing. A player who is out —
 * crushed in the heats, say — keeps the arena and watches the rest of the round.
 */
export function canSpectate(gameId: GameId): boolean {
  return gameId === 'crusher-escalator'
}
