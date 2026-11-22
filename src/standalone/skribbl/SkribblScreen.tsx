import { useMediaQuery } from '../../hooks/index.ts'
import { useSkribblSnapshot } from '../../network/useNetwork.ts'
import type { SkribblConnection, SkribblSnapshot } from '../../network/skribblConnection.ts'
import { breakpoint, color, fluid, font, pegboard, sharedStyles } from '../../theme/index.ts'
import { sfx, useSoundOnChange } from '../../audio/sfx/index.ts'
import { DrawingBoard } from './board/DrawingBoard.tsx'
import { ChoosingOverlay, PodiumOverlay, TurnEndOverlay } from './overlays.tsx'
import { ChatPanel, PlayerList, TurnTimer, WordDisplay } from './parts.tsx'
import { SkribblLobby } from './SkribblLobby.tsx'

interface SkribblScreenProps {
  game: SkribblConnection
  /** Leave the game and go back to the party lobby. */
  onLeave: () => void
}

/** Skribbl, from its own lobby through every turn to the final scores. */
export function SkribblScreen({ game, onLeave }: SkribblScreenProps) {
  const snapshot = useSkribblSnapshot(game)
  const selfId = game.playerId
  const { view } = snapshot
  const compact = useMediaQuery(breakpoint.compact)
  const short = useMediaQuery(breakpoint.short)
  const tight = compact || short

  return (
    <section
      style={{
        width: '100%',
        minHeight: '100dvh',
        background: color.cream,
        ...pegboard(),
        color: color.ink,
        fontFamily: font.body,
        display: 'flex',
        flexDirection: 'column',
        // Clear of a phone's notch and home bar.
        padding: `max(${fluid(12, 24)}, env(safe-area-inset-top)) max(${fluid(12, 32)}, env(safe-area-inset-right)) ${MUSIC_BUTTON_CLEARANCE} max(${fluid(12, 32)}, env(safe-area-inset-left))`,
        gap: fluid(12, 20),
        boxSizing: 'border-box',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: tight ? 10 : 16, flexWrap: 'wrap' }}>
        <button type="button" onClick={onLeave} style={{ ...sharedStyles.inlineAction, fontSize: 13 }}>
          {tight ? '← PARTY' : '← BACK TO PARTY'}
        </button>
        <div style={{ ...sharedStyles.displayHeading, fontSize: fluid(24, 36) }}>Skribbl</div>
        <div style={{ ...sharedStyles.eyebrow, flex: 1 }}>{tight ? '' : 'STANDALONE GAMES'}</div>
        {!snapshot.isConnected && <div style={{ fontWeight: 800, color: color.red }}>Reconnecting…</div>}
        {view.phase !== 'lobby' && view.ownerId === selfId && (
          <button
            type="button"
            onClick={() => { void game.returnToLobby().catch(() => undefined) }}
            style={{ ...sharedStyles.inlineAction, fontSize: 12 }}
          >
            END GAME
          </button>
        )}
      </header>

      {view.phase === 'lobby' ? (
        <SkribblLobby game={game} snapshot={snapshot} selfId={selfId} />
      ) : (
        <SkribblGame game={game} snapshot={snapshot} selfId={selfId} />
      )}
    </section>
  )
}

/** Room under the content for the floating music button (bottom-left), so it never covers the chat box. */
const MUSIC_BUTTON_CLEARANCE = 'calc(max(14px, env(safe-area-inset-bottom)) + 60px)'

/** Below the board on a narrow screen, the players and the chat share this height. */
const NARROW_CHAT_HEIGHT = 'clamp(220px, 38dvh, 320px)'
/** A phone held sideways: the board as tall as the window allows, the players and chat beside it at that height. */
const SHORT_PANEL_HEIGHT = 'max(200px, calc(100dvh - 150px))'
const SHORT_BOARD_COLUMN = `min(55%, calc(${SHORT_PANEL_HEIGHT} * 4 / 3))`

interface SkribblGameProps {
  game: SkribblConnection
  snapshot: SkribblSnapshot
  selfId: string
}

function SkribblGame({ game, snapshot, selfId }: SkribblGameProps) {
  const { view, chat } = snapshot
  const { turn } = view
  const narrow = useMediaQuery(breakpoint.narrow)
  const compact = useMediaQuery(breakpoint.compact)
  const short = useMediaQuery(breakpoint.short)
  /** Small header bar and player rows: a phone either way up. */
  const tight = compact || short
  const layout = short ? 'short' : narrow ? 'narrow' : 'wide'
  const panelHeight = layout === 'short' ? SHORT_PANEL_HEIGHT : layout === 'narrow' ? NARROW_CHAT_HEIGHT : null

  const isDrawer = turn.drawerId === selfId
  const hasGuessed = turn.guessed.includes(selfId)
  const drawer = view.players.find((player) => player.playerId === turn.drawerId)
  const word = snapshot.word?.turnId === turn.turnId ? snapshot.word.word : null
  const choices = isDrawer && snapshot.wordChoices?.turnId === turn.turnId ? snapshot.wordChoices : null
  const turnEnded = turn.phase === 'reveal' && snapshot.turnEnded?.turnId === turn.turnId ? snapshot.turnEnded : null
  const gameEnded = view.phase === 'podium' ? snapshot.gameEnded : null

  // A chime for every correct guess, and a bigger one for your own.
  useSoundOnChange(turn.guessed.length, (count, previous) => {
    if (count <= previous) return
    if (turn.guessed.at(-1) === selfId) sfx.ui.ready()
    else sfx.ui.playerJoin()
  })
  useSoundOnChange(turn.phase, (phase) => {
    if (phase === 'reveal') sfx.flow.reveal()
  })
  useSoundOnChange(view.phase, (phase) => {
    if (phase === 'podium') sfx.flow.fanfare()
  })

  const wordLabel =
    turn.phase !== 'drawing' && turn.phase !== 'reveal'
      ? ''
      : isDrawer
        ? 'DRAW THIS'
        : hasGuessed
          ? 'YOU GOT IT'
          : 'GUESS THIS'
  const chatPlaceholder = turn.phase === 'drawing' && !isDrawer && !hasGuessed ? 'Type your guess here…' : 'Chat…'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: fluid(10, 16), minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tight ? 10 : 16,
          padding: tight ? '6px 10px' : '8px 14px',
          background: color.white,
          border: `3px solid ${color.ink}`,
          borderRadius: 16,
        }}
      >
        <TurnTimer game={game} endsAtServerMs={turn.phase === 'drawing' ? turn.endsAtServerMs : null} size={tight ? 44 : 56} />
        {tight ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ ...sharedStyles.microLabel, fontSize: 9 }}>ROUND</div>
            <div style={{ fontWeight: 900, fontSize: 15, whiteSpace: 'nowrap' }}>
              {Math.max(1, turn.round)}/{turn.totalRounds}
            </div>
          </div>
        ) : (
          <div style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
            Round {Math.max(1, turn.round)} of {turn.totalRounds}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <WordDisplay word={word} pattern={turn.wordPattern} label={wordLabel} compact={tight} />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gap: fluid(10, 16),
          minHeight: 0,
          // On a phone, the board on top and the players beside the chat under it, as skribbl.io does.
          gridTemplateColumns:
            layout === 'short'
              ? `minmax(0, ${SHORT_BOARD_COLUMN}) minmax(0, 2fr) minmax(0, 3fr)`
              : layout === 'narrow'
                ? compact
                  ? 'minmax(0, 2fr) minmax(0, 3fr)'
                  : 'minmax(0, 1fr) minmax(0, 2fr)'
                : 'minmax(180px, 230px) minmax(0, 1fr) minmax(240px, 320px)',
          gridTemplateAreas:
            layout === 'short' ? '"board players chat"' : layout === 'narrow' ? '"board board" "players chat"' : '"players board chat"',
          alignItems: 'start',
        }}
      >
        <div
          style={{
            gridArea: 'players',
            minWidth: 0,
            ...(panelHeight ? { height: panelHeight, overflowY: 'auto' as const } : {}),
          }}
        >
          <PlayerList players={view.players} selfId={selfId} drawerId={turn.drawerId} guessed={turn.guessed} compact={tight} />
        </div>

        <div
          style={{
            gridArea: 'board',
            position: 'relative',
            minWidth: 0,
            width: '100%',
            justifySelf: 'center',
            // Keep the board and its toolbar inside the window: beside the rails, and on a phone held sideways.
            maxWidth:
              layout === 'short'
                ? undefined
                : layout === 'narrow'
                  ? 'max(280px, calc((100dvh - 150px) * 4 / 3))'
                  : 'max(420px, calc((100dvh - 330px) * 4 / 3))',
          }}
        >
          <DrawingBoard game={game} turnId={turn.turnId} canDraw={isDrawer && turn.phase === 'drawing' && view.phase === 'playing'} />
          {view.phase === 'playing' && turn.phase === 'choosing' && (
            <ChoosingOverlay
              key={turn.turnId}
              game={game}
              choices={choices}
              drawerName={drawer?.name ?? 'Someone'}
              endsAtServerMs={turn.endsAtServerMs}
            />
          )}
          {turnEnded && <TurnEndOverlay turnEnded={turnEnded} players={view.players} />}
          {gameEnded && <PodiumOverlay game={game} gameEnded={gameEnded} players={view.players} selfId={selfId} />}
        </div>

        <div style={{ gridArea: 'chat', minWidth: 0, height: panelHeight ?? 'min(70vh, 640px)', display: 'flex' }}>
          <ChatPanel game={game} lines={chat} players={view.players} placeholder={chatPlaceholder} />
        </div>
      </div>
    </div>
  )
}
