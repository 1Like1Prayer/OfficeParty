import { gameCopy } from '../../content/gameCopy.ts'
import type { GameMeta } from '../../shared/games/catalog.ts'
import { color, sharedStyles } from '../../theme/index.ts'
import { ReadyCheck } from './ReadyCheck.tsx'
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
}: GameRevealProps) {
  return (
    <section style={{ ...sharedStyles.phasePane, gap: 24 }}>
      {isTiebreak && <div style={sharedStyles.eyebrow}>TIEBREAK</div>}
      <h1
        style={{
          ...sharedStyles.displayHeading,
          margin: 0,
          fontSize: 92,
          lineHeight: 0.92,
          letterSpacing: '-0.035em',
          color: color.red,
          maxWidth: '13ch',
          animation: 'pa-rise .35s ease-out',
        }}
      >
        {game.title}
      </h1>
      <RulesCard rules={gameCopy(game.id).rules} />
      <ReadyCheck
        waitingFor={waitingFor}
        readyCount={readyCount}
        participantCount={participantCount}
        onReady={onReady}
        isReady={isReady}
        isSpectator={isSpectator}
      />
    </section>
  )
}
