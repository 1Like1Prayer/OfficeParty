import type { GameId } from '../shared/games/catalog.ts'
import { CrusherEscalator } from './CrusherEscalator/CrusherEscalator.tsx'
import { TypeRacer } from './TypeRacer/TypeRacer.tsx'
import { CubeCounter } from './CubeCounter/CubeCounter.tsx'
import { Minefield } from './Minefield/Minefield.tsx'
import { LogDodge } from './LogDodge/LogDodge.tsx'
import { StopTheClock } from './StopTheClock/StopTheClock.tsx'
import type { GameSurfaceProps } from './types.ts'

/**
 * The games that can actually be played in the browser, dispatched statically
 * so each surface is a real component rather than one picked at render time.
 * A game missing here cannot be played, mirroring the server's `registry.ts`
 * refusing to put it in a playlist.
 */
export function GameSurface({ gameId, ...props }: { gameId: GameId } & GameSurfaceProps) {
  switch (gameId) {
    case 'crusher-escalator':
      return <CrusherEscalator {...props} />
    case 'cube-counter':
      return <CubeCounter {...props} />
    case 'type-racer-roulette':
      return <TypeRacer {...props} />
    case 'log-dodge':
      return <LogDodge {...props} />
    case 'minefield':
      return <Minefield {...props} />
    case 'stop-the-clock':
      return <StopTheClock {...props} />
    default:
      return null
  }
}

