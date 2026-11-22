import { useState, type ReactNode } from 'react'
import type { SkribblConnection, SkribblPlayerView } from '../../network/skribblConnection.ts'
import { describeRequestError } from '../../network/errors.ts'
import type { GameEndedPayload, TurnEndedPayload, WordChoicesPayload } from '../../shared/standalone/skribbl/protocol.ts'
import { border, color, font, lift, sharedStyles } from '../../theme/index.ts'
import { sfx } from '../../audio/sfx/index.ts'
import { Avatar } from '../../components/ui/index.ts'
import { swatchFor, useSecondsLeft } from './helpers.ts'

/** Dims the board and holds a card in its middle. */
export function BoardOverlay({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 16,
        background: 'rgba(46,42,69,.72)',
        display: 'flex',
        padding: 'clamp(8px, 2.5vw, 16px)',
        animation: 'pa-fade-up .25s ease-out',
        overflow: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Centred with auto margins, not align-items, so content taller than a phone-sized board scrolls instead of clipping. */}
      <div
        style={{
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(8px, 2vw, 14px)',
          color: color.white,
          textAlign: 'center',
          maxWidth: '100%',
        }}
      >
        {children}
      </div>
    </div>
  )
}

const title = { ...sharedStyles.displayHeading, fontSize: 'clamp(19px, 3.2vw, 34px)' }

/* ------------------------------------------------------------------ */

interface ChoosingProps {
  game: SkribblConnection
  /** Set for the drawer only. */
  choices: WordChoicesPayload | null
  drawerName: string
  endsAtServerMs: number | null
}

/** The drawer picks one of the offered words; everyone else waits. */
export function ChoosingOverlay({ game, choices, drawerName, endsAtServerMs }: ChoosingProps) {
  const seconds = useSecondsLeft(game, endsAtServerMs)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState(false)

  if (!choices) {
    return (
      <BoardOverlay>
        <div style={title}>{drawerName} is choosing a word…</div>
        {seconds !== null && <div style={{ fontWeight: 800 }}>{seconds}s</div>}
      </BoardOverlay>
    )
  }
  return (
    <BoardOverlay>
      <div style={title}>Choose a word</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(6px, 1.6vw, 12px)', justifyContent: 'center' }}>
        {choices.words.map((word, index) => (
          <button
            key={word}
            type="button"
            disabled={picked}
            onClick={() => {
              sfx.ui.click()
              setPicked(true)
              game.chooseWord(index).catch((failure: unknown) => {
                setPicked(false)
                setError(describeRequestError(failure))
              })
            }}
            style={{
              ...sharedStyles.raised(5),
              padding: 'clamp(8px, 1.6vw, 12px) clamp(12px, 3vw, 22px)',
              borderRadius: 14,
              background: color.yellow,
              color: color.ink,
              fontSize: 'clamp(16px, 2.6vw, 22px)',
            }}
          >
            {word}
          </button>
        ))}
      </div>
      {seconds !== null && <div style={{ fontWeight: 800 }}>A word is picked for you in {seconds}s</div>}
      {error && <div style={{ fontWeight: 800, color: color.pinkSoft }}>{error}</div>}
    </BoardOverlay>
  )
}

/* ------------------------------------------------------------------ */

const REASONS: Record<TurnEndedPayload['reason'], string> = {
  time: 'Time’s up!',
  'all-guessed': 'Everybody guessed it!',
  'drawer-left': 'The drawer left.',
}

interface TurnEndProps {
  turnEnded: TurnEndedPayload
  players: SkribblPlayerView[]
}

/** The word, and what everyone scored this turn. */
export function TurnEndOverlay({ turnEnded, players }: TurnEndProps) {
  const byId = new Map(players.map((player) => [player.playerId, player]))
  return (
    <BoardOverlay>
      <div style={{ fontWeight: 800, opacity: 0.85 }}>{REASONS[turnEnded.reason]}</div>
      {turnEnded.word && (
        <div style={title}>
          The word was <span style={{ color: color.yellow }}>{turnEnded.word}</span>
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4, width: 'min(260px, 100%)' }}>
        {turnEnded.points.map((row) => {
          const player = byId.get(row.playerId)
          if (!player) return null
          return (
            <li key={row.playerId} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontWeight: 800, fontSize: 'clamp(14px, 2vw, 17px)' }}>
              <span style={sharedStyles.ellipsis}>{player.name}</span>
              <span style={{ color: row.points > 0 ? color.green : color.mutedSoft }}>+{row.points}</span>
            </li>
          )
        })}
      </ul>
    </BoardOverlay>
  )
}

/* ------------------------------------------------------------------ */

interface PodiumProps {
  game: SkribblConnection
  gameEnded: GameEndedPayload
  players: SkribblPlayerView[]
  selfId: string
}

const MEDALS = ['🥇', '🥈', '🥉']

/** The final scores, until the room goes back to its lobby. */
export function PodiumOverlay({ game, gameEnded, players, selfId }: PodiumProps) {
  const byId = new Map(players.map((player) => [player.playerId, player]))
  const seconds = useSecondsLeft(game, gameEnded.lobbyAtServerMs)
  return (
    <BoardOverlay>
      <div style={title}>{gameEnded.reason === 'finished' ? 'Final scores' : 'Not enough players left'}</div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 1vw, 8px)', width: 'min(300px, 100%)' }}>
        {gameEnded.rows.map((row) => {
          const player = byId.get(row.playerId)
          if (!player) return null
          const top = row.rank <= 3
          return (
            <li
              key={row.playerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(6px, 1.4vw, 10px)',
                padding: 'clamp(4px, 1vw, 8px) clamp(8px, 1.6vw, 12px)',
                borderRadius: 14,
                background: row.rank === 1 ? color.yellow : color.white,
                color: color.ink,
                border: border.medium,
                boxShadow: lift(3),
                fontFamily: font.display,
                fontSize: top ? 'clamp(16px, 2.4vw, 20px)' : 'clamp(14px, 2vw, 17px)',
              }}
            >
              <span style={{ width: 28, flexShrink: 0 }}>{MEDALS[row.rank - 1] ?? `#${row.rank}`}</span>
              <Avatar initial={player.name.slice(0, 1).toUpperCase()} background={swatchFor(player)} seed={player.avatar} size={26} />
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left', ...sharedStyles.ellipsis }}>
                {player.name}
                {row.playerId === selfId ? ' (you)' : ''}
              </span>
              <span>{row.points}</span>
            </li>
          )
        })}
      </ol>
      {seconds !== null && <div style={{ fontWeight: 800, opacity: 0.85 }}>Back to the lobby in {seconds}s</div>}
    </BoardOverlay>
  )
}
