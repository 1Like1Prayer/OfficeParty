import type { GameId } from '../shared/games/catalog.ts'
import { CrusherEscalatorDemo } from './CrusherEscalator/CrusherEscalatorDemo.tsx'
import { CubeCounterDemo } from './CubeCounter/CubeCounterDemo.tsx'
import { HexDropDemo } from './HexDrop/HexDropDemo.tsx'
import { LogDodgeDemo } from './LogDodge/LogDodgeDemo.tsx'
import { MinefieldDemo } from './Minefield/MinefieldDemo.tsx'
import { StopTheClockDemo } from './StopTheClock/StopTheClockDemo.tsx'
import { TypeRacerDemo } from './TypeRacer/TypeRacerDemo.tsx'

/** The game's looping demo round for the reveal screen (see `hasDemo`), or nothing for a game that explains itself in words. */
export function GameDemo({ gameId }: { gameId: GameId }) {
  switch (gameId) {
    case 'stop-the-clock':
      return <StopTheClockDemo />
    case 'cube-counter':
      return <CubeCounterDemo />
    case 'log-dodge':
      return <LogDodgeDemo />
    case 'crusher-escalator':
      return <CrusherEscalatorDemo />
    case 'type-racer-roulette':
      return <TypeRacerDemo />
    case 'minefield':
      return <MinefieldDemo />
    case 'hex-drop':
      return <HexDropDemo />
    default:
      return null
  }
}
