import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatLine, SkribblConnection, SkribblPlayerView } from '../../network/skribblConnection.ts'
import { SKRIBBL_CHAT } from '../../shared/standalone/skribbl/constants.ts'
import { HIDDEN } from '../../shared/standalone/skribbl/hints.ts'
import { border, color, fluid, font, sharedStyles } from '../../theme/index.ts'
import { Avatar } from '../../components/ui/index.ts'
import { swatchFor, useSecondsLeft } from './helpers.ts'

/* ------------------------------------------------------------------ */
/* Players                                                              */
/* ------------------------------------------------------------------ */

interface PlayerListProps {
  players: SkribblPlayerView[]
  selfId: string
  drawerId: string | null
  guessed: string[]
  /** Phone-sized: a narrow column beside the chat. */
  compact?: boolean
}

/** Everyone, best score first: who draws, who has guessed. */
export function PlayerList({ players, selfId, drawerId, guessed, compact = false }: PlayerListProps) {
  const ranked = [...players].sort((a, b) => b.points - a.points || a.joinOrder - b.joinOrder)
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ranked.map((player, index) => {
        const hasGuessed = guessed.includes(player.playerId)
        const isDrawer = player.playerId === drawerId
        return (
          <li
            key={player.playerId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: compact ? 6 : 8,
              padding: compact ? '4px 6px' : '6px 10px',
              borderRadius: compact ? 10 : 12,
              border: border.thin,
              background: hasGuessed ? color.green : isDrawer ? color.yellowSoft : color.white,
              opacity: player.connected ? 1 : 0.5,
            }}
          >
            {!compact && <span style={{ fontWeight: 900, fontSize: 13, width: 22, color: color.muted }}>#{index + 1}</span>}
            <Avatar initial={player.name.slice(0, 1).toUpperCase()} background={swatchFor(player)} seed={player.avatar} size={compact ? 24 : 32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...sharedStyles.ellipsis, fontWeight: 800, fontSize: compact ? 13 : 14 }}>
                {player.name}
                {player.playerId === selfId && !compact && <span style={{ color: color.muted, fontWeight: 700 }}> (you)</span>}
              </div>
              <div style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: color.muted }}>
                {player.points} pts{compact && player.playerId === selfId ? ' · you' : ''}
              </div>
            </div>
            {isDrawer && <span title="Drawing" aria-label="Drawing" style={{ fontSize: compact ? 15 : 18 }}>✏️</span>}
            {hasGuessed && <span title="Guessed it" aria-label="Guessed it" style={{ fontSize: 16 }}>✓</span>}
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------ */
/* Chat                                                                 */
/* ------------------------------------------------------------------ */

interface ChatPanelProps {
  game: SkribblConnection
  lines: ChatLine[]
  players: SkribblPlayerView[]
  placeholder: string
}

/** The chat room. While someone draws, what a guesser types is their guess. */
export function ChatPanel({ game, lines, players, placeholder }: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const names = useMemo(() => new Map(players.map((player) => [player.playerId, player.name])), [players])

  // Stay pinned to the newest line.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [lines])

  const send = () => {
    const text = draft.trim()
    if (text === '') return
    setDraft('')
    void game.say(text)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        width: '100%',
        height: '100%',
        background: color.white,
        border: border.medium,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <div
        ref={listRef}
        aria-live="polite"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {lines.map((line, index) => (
          <ChatRow key={line.id} line={line} name={'playerId' in line ? names.get(line.playerId) ?? 'Someone' : ''} striped={index % 2 === 1} />
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
        style={{ borderTop: border.thin, display: 'flex' }}
      >
        <input
          value={draft}
          maxLength={SKRIBBL_CHAT.MAX_LENGTH}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => { setDraft(event.target.value) }}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            padding: '12px 12px',
            fontFamily: font.body,
            fontWeight: 700,
            // 16px or more, or iOS Safari zooms the page in on focus.
            fontSize: 16,
            background: color.panel,
            color: color.ink,
          }}
        />
      </form>
    </div>
  )
}

function ChatRow({ line, name, striped }: { line: ChatLine; name: string; striped: boolean }) {
  const base = {
    padding: '3px 6px',
    borderRadius: 6,
    fontSize: 14,
    lineHeight: 1.35,
    overflowWrap: 'anywhere' as const,
    background: striped ? 'rgba(46,42,69,.04)' : 'transparent',
  }
  switch (line.kind) {
    case 'message':
      return (
        <div style={{ ...base, ...(line.channel === 'guessed' ? { background: 'rgba(156,232,106,.35)', color: '#2B6B12' } : {}) }}>
          <b>{name}:</b> {line.text}
        </div>
      )
    case 'guessed':
      return <div style={{ ...base, fontWeight: 900, color: '#2B8A12' }}>{name} guessed the word! (+{line.points})</div>
    case 'close':
      return <div style={{ ...base, fontWeight: 800, color: '#B07A00' }}>{line.text}</div>
    case 'notice':
      return <div style={{ ...base, fontWeight: 800, color: color.red }}>{line.text}</div>
    case 'turn':
      return <div style={{ ...base, fontWeight: 900, color: '#2F6FD0' }}>{line.text}</div>
  }
}

/* ------------------------------------------------------------------ */
/* Timer and word                                                       */
/* ------------------------------------------------------------------ */

export function TurnTimer({ game, endsAtServerMs, size = 56 }: { game: SkribblConnection; endsAtServerMs: number | null; size?: number }) {
  const seconds = useSecondsLeft(game, endsAtServerMs)
  const urgent = seconds !== null && seconds <= 10
  return (
    <div
      aria-label={seconds === null ? 'Timer' : `${seconds} seconds left`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 999,
        border: border.medium,
        background: urgent ? color.pinkSoft : color.white,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: Math.round(size * 0.4),
        color: urgent ? color.red : color.ink,
        animation: urgent ? 'pa-pulse 1s ease-in-out infinite' : undefined,
      }}
    >
      {seconds ?? '–'}
    </div>
  )
}

interface WordDisplayProps {
  /** The word itself, when this player may see it. */
  word: string | null
  /** What everyone else sees: '_' for each hidden letter. */
  pattern: string
  label: string
  /** Phone-sized: tighter letters, so a long word still fits. */
  compact?: boolean
}

/** The word to draw, or the blanks to guess, with each word's letter count. */
export function WordDisplay({ word, pattern, label, compact = false }: WordDisplayProps) {
  const shown = word ?? pattern
  const counts = pattern.split(/\s+/).filter(Boolean).map((part) => part.length)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}>
      <div style={{ ...sharedStyles.microLabel, fontSize: 10 }}>{label}</div>
      <div
        style={{
          fontFamily: font.mono,
          fontWeight: 800,
          fontSize: compact ? 18 : fluid(18, 26),
          letterSpacing: word ? '0.08em' : compact ? '0.18em' : '0.3em',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          textAlign: 'center',
          color: word ? '#2B8A12' : color.ink,
        }}
      >
        {shown === '' ? ' ' : [...shown].map((char) => (char === HIDDEN ? '_' : char)).join('')}
        {!word && pattern.includes(HIDDEN) && counts.length > 0 && (
          <sup style={{ fontFamily: font.body, fontSize: compact ? 10 : 12, letterSpacing: 0, marginLeft: compact ? 3 : 6, color: color.muted }}>
            {counts.join(', ')}
          </sup>
        )}
      </div>
    </div>
  )
}
