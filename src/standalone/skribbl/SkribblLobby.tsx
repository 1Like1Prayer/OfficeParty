import { useState } from 'react'
import type { SkribblConnection, SkribblSnapshot } from '../../network/skribblConnection.ts'
import { describeRequestError } from '../../network/errors.ts'
import { SKRIBBL_SETTINGS } from '../../shared/standalone/skribbl/constants.ts'
import type { SkribblSettings } from '../../shared/standalone/skribbl/protocol.ts'
import { border, color, fluid, sharedStyles } from '../../theme/index.ts'
import { Avatar, PushButton } from '../../components/ui/index.ts'
import { swatchFor } from './helpers.ts'
import { ChatPanel } from './parts.tsx'

interface SkribblLobbyProps {
  game: SkribblConnection
  snapshot: SkribblSnapshot
  selfId: string
}

interface SettingRow {
  key: keyof SkribblSettings
  label: string
  bounds: { min: number; max: number }
  step: number
  unit?: string
}

const SETTINGS: SettingRow[] = [
  { key: 'rounds', label: 'Rounds', bounds: SKRIBBL_SETTINGS.ROUNDS, step: 1 },
  { key: 'drawTimeSec', label: 'Draw time', bounds: SKRIBBL_SETTINGS.DRAW_TIME_SEC, step: 15, unit: 's' },
  { key: 'wordChoices', label: 'Word choices', bounds: SKRIBBL_SETTINGS.WORD_CHOICES, step: 1 },
  { key: 'hints', label: 'Hints', bounds: SKRIBBL_SETTINGS.HINTS, step: 1 },
]

/** Before (and between) games: who is here, the settings, and the start button. */
export function SkribblLobby({ game, snapshot, selfId }: SkribblLobbyProps) {
  const { view } = snapshot
  const isOwner = view.ownerId === selfId
  const owner = view.players.find((player) => player.playerId === view.ownerId)
  const [error, setError] = useState<string | null>(null)

  const run = (action: () => Promise<unknown>) => {
    setError(null)
    action().catch((failure: unknown) => { setError(describeRequestError(failure)) })
  }

  const startNote = !isOwner
    ? `Waiting for ${owner?.name ?? 'the host'} to start…`
    : view.blockedReason === 'not_enough_players'
      ? `Need at least ${view.minPlayers} players to start.`
      : 'Everyone’s here? Start when you’re ready.'

  return (
    <div style={{ flex: 1, display: 'flex', gap: fluid(16, 28), flexWrap: 'wrap', minHeight: 0 }}>
      <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: fluid(14, 20), minWidth: 0 }}>
        <div style={{ ...sharedStyles.bigCard, padding: fluid(14, 22) }}>
          <div style={sharedStyles.microLabel}>PLAYERS · {view.players.length}/{view.maxPlayers}</div>
          <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {view.players.map((player) => (
              <li
                key={player.playerId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px 6px 6px',
                  borderRadius: 999,
                  border: border.thin,
                  background: player.isOwner ? color.yellowSoft : color.white,
                  opacity: player.connected ? 1 : 0.5,
                  fontWeight: 800,
                }}
              >
                <Avatar initial={player.name.slice(0, 1).toUpperCase()} background={swatchFor(player)} seed={player.avatar} size={30} />
                {player.name}
                {player.playerId === selfId ? ' (you)' : ''}
                {player.isOwner && <span title="Host">👑</span>}
                {isOwner && player.playerId !== selfId && (
                  <button
                    type="button"
                    aria-label={`Remove ${player.name}`}
                    title={`Remove ${player.name}`}
                    onClick={() => { run(() => game.kick(player.playerId)) }}
                    style={{ ...sharedStyles.inlineAction, minWidth: 24, minHeight: 24, fontSize: 14 }}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ ...sharedStyles.bigCard, padding: fluid(14, 22), display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={sharedStyles.microLabel}>SETTINGS{isOwner ? '' : ' · SET BY THE HOST'}</div>
          {SETTINGS.map((row) => (
            <Stepper
              key={row.key}
              row={row}
              value={view.settings[row.key]}
              readOnly={!isOwner}
              onChange={(value) => { run(() => game.updateSettings({ [row.key]: value })) }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {isOwner && (
            <PushButton size="lg" disabled={!view.canStart} onClick={() => { run(() => game.start()) }}>
              Start Skribbl
            </PushButton>
          )}
          <div style={{ fontWeight: 700, color: view.canStart && isOwner ? color.ink : color.mutedStrong }}>{startNote}</div>
        </div>
        {error && <div style={{ fontWeight: 800, color: color.red }}>{error}</div>}
      </div>

      <div style={{ flex: '1 1 300px', minWidth: 0, minHeight: 320, display: 'flex' }}>
        <ChatPanel game={game} lines={snapshot.chat} players={view.players} placeholder="Say hi…" />
      </div>
    </div>
  )
}

interface StepperProps {
  row: SettingRow
  value: number
  readOnly: boolean
  onChange: (value: number) => void
}

function Stepper({ row, value, readOnly, onChange }: StepperProps) {
  const { min, max } = row.bounds
  const step = (direction: 1 | -1) => {
    const next = Math.min(max, Math.max(min, value + direction * row.step))
    if (next !== value) onChange(next)
  }
  const buttonStyle = {
    ...sharedStyles.raised(3),
    width: 34,
    height: 34,
    borderRadius: 10,
    background: color.white,
    color: color.ink,
    fontSize: 18,
    padding: 0,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontWeight: 800 }}>{row.label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!readOnly && (
          <button type="button" aria-label={`Less ${row.label}`} disabled={value <= min} onClick={() => { step(-1) }} style={buttonStyle}>
            −
          </button>
        )}
        <span style={{ minWidth: 48, textAlign: 'center', fontWeight: 900, fontSize: 18 }}>
          {value}
          {row.unit ?? ''}
        </span>
        {!readOnly && (
          <button type="button" aria-label={`More ${row.label}`} disabled={value >= max} onClick={() => { step(1) }} style={buttonStyle}>
            +
          </button>
        )}
      </div>
    </div>
  )
}
