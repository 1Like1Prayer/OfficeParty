import type { ReactNode } from 'react'
import { gameCopy } from '../../content/gameCopy.ts'
import { GameDemo } from '../../games/demos.tsx'
import { hasDemo } from '../../games/playable.ts'
import type { GameMeta } from '../../shared/games/catalog.ts'
import { color, fluid, sharedStyles } from '../../theme/index.ts'
import { ReadyCheck } from './ReadyCheck.tsx'
import { StartsIn } from './StartsIn.tsx'
import { RulesCard } from './RulesCard.tsx'

interface GameRevealProps {
  game: GameMeta
  isTiebreak: boolean
  /** Names still to press ready on their phones. */
  waitingFor: string[]
  readyCount: number
  participantCount: number
  onReady: (() => void) | null
  isReady: boolean
  isSpectator: boolean
  /** Count-in beats until the round takes over, or null while still waiting. */
  startsInBeats: number | null
  /** The host's skip / back-to-lobby controls, shown beside the ready check. */
  hostControls?: ReactNode
}

/**
 * Announces the next game while the server runs its ready check. There is no
 * button here — the round advances when the phones say so.
 */
export function GameReveal({
  game,
  isTiebreak,
  waitingFor,
  readyCount,
  participantCount,
  onReady,
  isReady,
  isSpectator,
  startsInBeats,
  hostControls,
}: GameRevealProps) {
  return (
    <section style={{ ...sharedStyles.phasePane, gap: fluid(16, 24) }}>
      {isTiebreak && <div style={sharedStyles.eyebrow}>TIEBREAK</div>}
      <h1
        style={{
          ...sharedStyles.displayHeading,
          margin: 0,
          fontSize: fluid(44, 92),
          lineHeight: 0.92,
          letterSpacing: '-0.035em',
          color: color.red,
          maxWidth: '13ch',
          animation: 'pa-rise .6s ease-out',
        }}
      >
        {game.title}
      </h1>
      {hasDemo(game.id) ? (
        <GameDemo gameId={game.id} />
      ) : (
        <RulesCard rules={gameCopy(game.id).rules} />
      )}
      {startsInBeats === null ? (
        <ReadyCheck
          waitingFor={waitingFor}
          readyCount={readyCount}
          participantCount={participantCount}
          onReady={onReady}
          isReady={isReady}
          isSpectator={isSpectator}
          hostControls={hostControls}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: `${fluid(12, 16)} ${fluid(20, 36)}`,
          }}
        >
          <StartsIn beats={startsInBeats} />
          {hostControls}
        </div>
      )}
    </section>
  )
}
