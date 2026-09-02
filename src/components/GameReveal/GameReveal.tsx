import { gameCopy } from '../../content/gameCopy.ts'
import { selectFormatLabel } from '../../selectors/index.ts'
import type { GameMeta } from '../../shared/games/catalog.ts'
import { color, sharedStyles } from '../../theme/index.ts'
import { Pill } from '../ui/index.ts'
import { ReadyCheck } from './ReadyCheck.tsx'
import { RulesCard } from './RulesCard.tsx'

interface GameRevealProps {
  game: GameMeta
  gameIndex: number
  totalGames: number
  isTiebreak: boolean
  /** Names still to press ready on their phones. */
  waitingFor: string[]
  readyCount: number
  participantCount: number
}

/**
 * Announces the next game while the server runs its ready check. There is no
 * button here — the round advances when the phones say so.
 */
export function GameReveal({
  game,
  gameIndex,
  totalGames,
  isTiebreak,
  waitingFor,
  readyCount,
  participantCount,
}: GameRevealProps) {
  const copy = gameCopy(game.id)

  return (
    <section style={{ ...sharedStyles.phasePane, gap: 24 }}>
      <div style={sharedStyles.eyebrow}>
        {isTiebreak ? 'TIEBREAK' : `NEXT UP · GAME ${gameIndex} OF ${totalGames}`}
      </div>
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
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Pill>{selectFormatLabel(game.kind)}</Pill>
        <Pill>{copy.input.toUpperCase()}</Pill>
        <Pill>~{copy.length}</Pill>
      </div>
      <RulesCard rules={copy.rules} />
      <ReadyCheck
        waitingFor={waitingFor}
        readyCount={readyCount}
        participantCount={participantCount}
      />
    </section>
  )
}
