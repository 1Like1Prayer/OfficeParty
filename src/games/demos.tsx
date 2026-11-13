import type { GameId } from '../shared/games/catalog.ts'
import { StopTheClockDemo } from './StopTheClock/StopTheClockDemo.tsx'

/** The game's looping demo round for the reveal screen (see `hasDemo`), or nothing for a game that explains itself in words. */
export function GameDemo({ gameId }: { gameId: GameId }) {
  switch (gameId) {
    case 'stop-the-clock':
      return <StopTheClockDemo />
    default:
      return null
  }
}
