import { selectFormatLabel } from '../../selectors/index.ts'
import { color, sharedStyles } from '../../theme/index.ts'
import type { Game } from '../../types/index.ts'
import { Pill, PushButton } from '../ui/index.ts'
import { RulesCard } from './RulesCard.tsx'

interface GameRevealProps {
  game: Game
  gameNumber: number
  totalGames: number
  onBeginGame: () => void
}

/** Announces the next minigame and its rules before play starts. */
export function GameReveal({ game, gameNumber, totalGames, onBeginGame }: GameRevealProps) {
  return (
    <section style={{ ...sharedStyles.phasePane, gap: 24 }}>
      <div style={sharedStyles.eyebrow}>
        NEXT UP · GAME {gameNumber} OF {totalGames}
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
        {game.name}
      </h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Pill>{selectFormatLabel(game.kind)}</Pill>
        <Pill>{game.input.toUpperCase()}</Pill>
        <Pill>~{game.length}</Pill>
      </div>
      <RulesCard rules={game.rules} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <PushButton onClick={onBeginGame}>Everyone ready</PushButton>
        <div style={{ fontWeight: 700, fontSize: 15, color: color.mutedStrong }}>
          Check your phone — controls change every game.
        </div>
      </div>
    </section>
  )
}
