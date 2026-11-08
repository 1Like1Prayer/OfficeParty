import type { GameId } from '../shared/games/catalog.ts'

/**
 * Games this client can actually render a surface for. Kept beside the
 * dispatcher in `index.tsx` and must be updated with it — a game the server
 * will play but the client cannot draw would leave players staring at nothing.
 */
export function hasSurface(gameId: GameId): boolean {
  return gameId === 'stop-the-clock'
}
