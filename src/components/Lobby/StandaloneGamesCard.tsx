import { useHover } from '../../hooks/index.ts'
import type { StandaloneGameId, StandaloneGameMeta } from '../../shared/standalone/catalog.ts'
import { border, color, fluid, lift, sharedStyles } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'

interface StandaloneGamesCardProps {
  games: StandaloneGameMeta[]
  /** The game the room has open right now, if any. */
  openGameId: StandaloneGameId | null
  isOwner: boolean
  ownerName: string
  /** Owner: open a game for everyone. */
  onLaunch: (gameId: StandaloneGameId) => void
  /** Join the game the room has open. */
  onJoin: () => void
}

/** Games played on their own, outside the run. Picking one takes the whole room into it. */
export function StandaloneGamesCard({ games, openGameId, isOwner, ownerName, onLaunch, onJoin }: StandaloneGamesCardProps) {
  return (
    <div
      style={{
        ...sharedStyles.bigCard,
        flex: 1,
        minHeight: 0,
        padding: `${fluid(16, 24)} ${fluid(16, 28)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: fluid(12, 18),
      }}
    >
      <div style={sharedStyles.microLabel}>STANDALONE GAMES</div>
      <div style={{ fontWeight: 700, color: color.muted, fontSize: fluid(14, 15) }}>
        {isOwner
          ? 'Pick a game and everyone in the room comes along. Back to the party any time.'
          : `${ownerName} picks the game; you’ll be taken there when it opens.`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {games.map((game) => (
          <GameRow
            key={game.id}
            game={game}
            isOpen={openGameId === game.id}
            otherIsOpen={openGameId !== null && openGameId !== game.id}
            isOwner={isOwner}
            onLaunch={() => { onLaunch(game.id) }}
            onJoin={onJoin}
          />
        ))}
      </div>
    </div>
  )
}

interface GameRowProps {
  game: StandaloneGameMeta
  isOpen: boolean
  otherIsOpen: boolean
  isOwner: boolean
  onLaunch: () => void
  onJoin: () => void
}

function GameRow({ game, isOpen, otherIsOpen, isOwner, onLaunch, onJoin }: GameRowProps) {
  const [hovered, handlers] = useHover()
  return (
    <div
      {...handlers}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: fluid(12, 18),
        flexWrap: 'wrap',
        padding: fluid(12, 16),
        borderRadius: 18,
        border: border.medium,
        background: isOpen ? color.yellowSoft : hovered ? color.panel : color.white,
        boxShadow: lift(4),
        opacity: game.implemented ? 1 : 0.55,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 52,
          height: 52,
          flexShrink: 0,
          borderRadius: 14,
          border: border.medium,
          background: color.pinkSoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        🖍️
      </div>
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <div style={{ ...sharedStyles.displayHeading, fontSize: fluid(22, 26) }}>{game.title}</div>
        <div style={{ fontWeight: 700, fontSize: 14, color: color.muted, marginTop: 4 }}>{game.description}</div>
        <div style={{ ...sharedStyles.microLabel, marginTop: 6 }}>
          {game.minPlayers}–{game.maxPlayers} PLAYERS
        </div>
      </div>
      {isOpen ? (
        <PushButton size="sm" variant="success" onClick={onJoin}>
          Join game
        </PushButton>
      ) : isOwner ? (
        <PushButton size="sm" disabled={!game.implemented || otherIsOpen} onClick={onLaunch}>
          Play
        </PushButton>
      ) : null}
    </div>
  )
}
