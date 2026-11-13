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
    gameId === 'crusher-escalator' ||
    gameId === 'type-racer-roulette' ||
    gameId === 'log-dodge' ||
    gameId === 'minefield'
  )
}

/**
 * Games that draw edge to edge. The play screen hands them the whole pane and
 * lays its title and countdown over the top instead of stacking them above.
 */
export function isFullBleed(gameId: GameId): boolean {
  return (
    gameId === 'crusher-escalator' ||
    gameId === 'type-racer-roulette' ||
    gameId === 'log-dodge' ||
    gameId === 'minefield'
  )
}

/**
 * Games whose screen is worth watching without playing. A player who is out —
 * crushed in the heats, say — keeps the arena and watches the rest of the round.
 */
export function canSpectate(gameId: GameId): boolean {
  return gameId === 'crusher-escalator'
}

/**
 * Games whose own screen already says what they are, so the play screen's
 * title over the top of it is only in the way.
 */
export function hidesTitle(gameId: GameId): boolean {
  return gameId === 'type-racer-roulette' || gameId === 'stop-the-clock' || gameId === 'cube-counter'
}

/**
 * Games that sit in the middle of the play screen rather than at its top. Only
 * safe for a game that reserves room for everything it shows, so nothing moves
 * as its parts come and go.
 */
export function centersInPane(gameId: GameId): boolean {
  return gameId === 'stop-the-clock' || gameId === 'cube-counter'
}

/**
 * Games whose title is only worth showing while the round is being set up.
 * Once play begins it is in the way of the game, so it goes.
 */
export function hidesTitleOncePlaying(gameId: GameId): boolean {
  return gameId === 'log-dodge' || gameId === 'minefield'
}

/**
 * Games that show a looping demo round on the reveal screen instead of the
 * written rules. Must match the cases `GameDemo` in `demos.tsx` renders.
 */
export function hasDemo(gameId: GameId): boolean {
  return gameId === 'stop-the-clock' || gameId === 'cube-counter'
}
