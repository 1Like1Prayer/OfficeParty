import { color, font } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'
import { ConnectedCard, type Floater } from './ConnectedCard.tsx'
import { GamePoolCard, type PoolChipView } from './GamePoolCard.tsx'
import { LobbyHeader } from './LobbyHeader.tsx'
import { RoundsCard } from './RoundsCard.tsx'

interface LobbyProps {
  roomCode: string
  floaters: Floater[]
  /** What to say while nobody has joined yet. */
  emptyLine: string
  setupSummary: string
  roundsPerGame: number
  roundsOptions: number[]
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
  onSetRounds: (rounds: number) => void
  onToggleGame: (id: string) => void
  onToggleAll: () => void
  onBack: () => void
}

/** Waiting room: who is here, what the run looks like, and the start button. */
export function Lobby({
  roomCode,
  floaters,
  emptyLine,
  setupSummary,
  roundsPerGame,
  roundsOptions,
  chips,
  toggleAllLabel,
  canStart,
  isOwner,
  isReady,
  startNote,
  onStart,
  onSetReady,
  onSetRounds,
  onToggleGame,
  onToggleAll,
  onBack,
}: LobbyProps) {
  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '44px 64px 52px',
        gap: 40,
        minHeight: 0,
        animation: 'pa-swoop .45s ease-out',
      }}
    >
      <LobbyHeader roomCode={roomCode} onBack={onBack} />

      <div style={{ flex: 1, display: 'flex', gap: 40, minHeight: 0, flexWrap: 'wrap' }}>
        <div
          style={{
            flex: '1 1 360px',
            minWidth: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <ConnectedCard floaters={floaters} emptyLine={emptyLine} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {isOwner ? (
              <PushButton size="lg" onClick={onStart} disabled={!canStart}>
                Start the run
              </PushButton>
            ) : (
              <PushButton
                size="lg"
                variant={isReady ? 'success' : 'primary'}
                onClick={() => { onSetReady(!isReady) }}
              >
                {isReady ? "I'm ready ✓" : "I'm ready"}
              </PushButton>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 12,
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
                  fontSize: 15,
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
            minWidth: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <RoundsCard
            value={roundsPerGame}
            options={roundsOptions}
            readOnly={!isOwner}
            onChange={onSetRounds}
          />
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
