import { useState } from 'react'
import { useMediaQuery } from '../../hooks/index.ts'
import type { StandaloneGameId, StandaloneGameMeta } from '../../shared/standalone/catalog.ts'
import { border, breakpoint, color, fluid, font, lift } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'
import { ConnectedCard, type Floater } from './ConnectedCard.tsx'
import { GamePoolCard, type PoolChipView } from './GamePoolCard.tsx'
import { LobbyHeader } from './LobbyHeader.tsx'
import { StandaloneGamesCard } from './StandaloneGamesCard.tsx'
import { sfx, useSoundOnChange } from '../../audio/sfx/index.ts'

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
  /** The "Standalone games" section. */
  standalone: LobbyStandaloneProps
}

export interface LobbyStandaloneProps {
  games: StandaloneGameMeta[]
  /** The game the room has open right now, if any. */
  open: StandaloneGameMeta | null
  ownerName: string
  onLaunch: (gameId: StandaloneGameId) => void
  onJoin: () => void
}

type LobbyTab = 'mini' | 'standalone'

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
  standalone,
}: LobbyProps) {
  const compact = useMediaQuery(breakpoint.compact)
  const [tab, setTab] = useState<LobbyTab>('mini')
  // A pop for each arrival, a falling one for each departure.
  useSoundOnChange(floaters.map(({ id }) => id).join(' '), (next, previous) => {
    const now = new Set(next.split(' ').filter(Boolean))
    const before = new Set(previous.split(' ').filter(Boolean))
    if ([...now].some((id) => !before.has(id))) sfx.ui.playerJoin()
    else if ([...before].some((id) => !now.has(id))) sfx.ui.playerLeave()
  })

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div role="tablist" aria-label="Sections" style={{ display: 'flex', gap: 8 }}>
          <TabButton label="Mini games" active={tab === 'mini'} onClick={() => { setTab('mini') }} />
          <TabButton label="Standalone games" active={tab === 'standalone'} onClick={() => { setTab('standalone') }} />
        </div>
        {standalone.open && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontWeight: 800 }}>
            <span>{standalone.open.title} is being played.</span>
            <PushButton size="sm" variant="success" onClick={standalone.onJoin}>
              Join game
            </PushButton>
          </div>
        )}
      </div>

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
          {tab === 'mini' && (
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
                silent
                onClick={() => {
                  if (isReady) sfx.ui.unready()
                  else sfx.ui.ready()
                  onSetReady(!isReady)
                }}
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
          )}
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
          {tab === 'mini' ? (
            <GamePoolCard
              chips={chips}
              toggleAllLabel={toggleAllLabel}
              readOnly={!isOwner}
              onToggle={onToggleGame}
              onToggleAll={onToggleAll}
            />
          ) : (
            <StandaloneGamesCard
              games={standalone.games}
              openGameId={standalone.open?.id ?? null}
              isOwner={isOwner}
              ownerName={standalone.ownerName}
              onLaunch={standalone.onLaunch}
              onJoin={standalone.onJoin}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => {
        sfx.ui.toggle()
        onClick()
      }}
      style={{
        padding: `${fluid(8, 10)} ${fluid(14, 20)}`,
        borderRadius: 999,
        border: border.medium,
        background: active ? color.ink : color.white,
        color: active ? color.white : color.ink,
        boxShadow: active ? 'none' : lift(3),
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: fluid(15, 17),
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
