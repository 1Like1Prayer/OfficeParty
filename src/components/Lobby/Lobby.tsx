import { useMediaQuery } from '../../hooks/index.ts'
import { breakpoint, color, fluid, font } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'
import { ConnectedCard, type Floater } from './ConnectedCard.tsx'
import { GamePoolCard, type PoolChipView } from './GamePoolCard.tsx'
import { LobbyHeader } from './LobbyHeader.tsx'

interface LobbyProps {
  roomCode: string
  floaters: Floater[]
  /** What to say while nobody has joined yet. */
  emptyLine: string
  setupSummary: string
  chips: PoolChipView[]
  toggleAllLabel: string
  canStart: boolean
  /** False on a screen that is only showing someone else's room. */
  isOwner: boolean
  /** Whether this player has pressed ready. The owner is always ready. */
  isReady: boolean
  /** Why start is unavailable, or the go-ahead when it is. */
  startNote: string
  onStart: () => void
  onSetReady: (ready: boolean) => void
  onToggleGame: (id: string) => void
  onToggleAll: () => void
  onBack: () => void
  /** This player, who can't remove themselves. */
  selfId: string | null
  /** Set for the owner only: remove a player from the room. */
  onKick: ((playerId: string) => void) | null
}

/** Waiting room: who is here, what the run looks like, and the start button. */
export function Lobby({
  roomCode,
  floaters,
  emptyLine,
  setupSummary,
  chips,
  toggleAllLabel,
  canStart,
  isOwner,
  isReady,
  startNote,
  onStart,
  onSetReady,
  onToggleGame,
  onToggleAll,
  onBack,
  selfId,
  onKick,
}: LobbyProps) {
  const compact = useMediaQuery(breakpoint.compact)

  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: `${fluid(20, 44)} ${fluid(16, 64)} ${fluid(28, 52)}`,
        gap: fluid(20, 40),
        minHeight: 0,
        animation: 'pa-swoop .45s ease-out',
      }}
    >
      <LobbyHeader roomCode={roomCode} onBack={onBack} />

      <div style={{ flex: 1, display: 'flex', gap: fluid(20, 40), minHeight: 0, flexWrap: 'wrap' }}>
        <div
          style={{
            flex: '1 1 360px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: fluid(16, 24),
          }}
        >
          <ConnectedCard floaters={floaters} emptyLine={emptyLine} selfId={selfId} onKick={onKick} />
          <div style={{ display: 'flex', alignItems: 'center', gap: fluid(12, 24), flexWrap: 'wrap' }}>
            {isOwner ? (
              <PushButton size="lg" fullWidth={compact} onClick={onStart} disabled={!canStart}>
                Start the run
              </PushButton>
            ) : (
              <PushButton
                size="lg"
                fullWidth={compact}
                variant={isReady ? 'success' : 'primary'}
                onClick={() => { onSetReady(!isReady) }}
              >
                {isReady ? "I'm ready ✓" : "I'm ready"}
              </PushButton>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: '1 1 200px' }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: fluid(11, 12),
                  letterSpacing: '0.14em',
                  color: color.mutedStrong,
                }}
              >
                {setupSummary}
              </div>
              <div
                style={{
                  fontFamily: font.body,
                  fontWeight: 700,
                  fontSize: fluid(14, 15),
                  color: canStart ? color.ink : color.mutedStrong,
                  animation: canStart ? 'pa-pulse 2.4s ease-in-out infinite' : undefined,
                }}
              >
                {startNote}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: '1 1 360px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: fluid(16, 24),
          }}
        >
          <GamePoolCard
            chips={chips}
            toggleAllLabel={toggleAllLabel}
            readOnly={!isOwner}
            onToggle={onToggleGame}
            onToggleAll={onToggleAll}
          />
        </div>
      </div>
    </section>
  )
}
