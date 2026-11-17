import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { backgroundMusic, TRACK_TITLE } from '../../audio/backgroundMusic.ts'
import { sfx, sfxEngine, useSfxSettings, type Channel } from '../../audio/sfx/index.ts'
import { useBackgroundMusic, useMediaQuery } from '../../hooks/index.ts'
import { border, color, font, lift, sharedStyles } from '../../theme/index.ts'

interface MusicControlProps {
  /** A game has the whole screen: on a phone its touch controls own the bottom-left corner, so the button moves to the top-left. */
  isGameUp: boolean
}

const BUTTON_SIZE = 46
const EDGE = 'max(14px, env(safe-area-inset-left))'
const BOTTOM = 'max(14px, env(safe-area-inset-bottom))'
const TOP = 'max(14px, env(safe-area-inset-top))'
/** Above everything, the TV intro's overlay included; only the screen-change stripes (1000) pass over it. */
const LAYER = 950

/**
 * The music button, floating in the bottom-left corner of every screen, and
 * the player it opens: play and pause, a bar to scrub through the track, a
 * skip back and forward, mute, and the volume.
 */
export function MusicControl({ isGameUp }: MusicControlProps) {
  const music = useBackgroundMusic()
  const isTouch = useMediaQuery('(pointer: coarse)')
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  // Closes on Escape, and on a click anywhere else.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false) }
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [isOpen])

  // Always on screen. During a game on a phone the bottom-left belongs to the
  // touch controls (the action button sits there), so the button moves to the
  // top-left, and the player opens downward from it. Moving closes the player.
  const isAtTop = isGameUp && isTouch
  const [wasAtTop, setWasAtTop] = useState(isAtTop)
  if (isAtTop !== wasAtTop) {
    setWasAtTop(isAtTop)
    setIsOpen(false)
  }

  const isOn = music.isPlaying && !music.isMuted && music.volume > 0

  return (
    <div
      ref={rootRef}
      style={{ position: 'fixed', left: EDGE, ...(isAtTop ? { top: TOP } : { bottom: BOTTOM }), zIndex: LAYER }}
      // Keys pressed in the player (space on a button, arrows on a slider) are not game input.
      onKeyDown={(event) => { event.stopPropagation() }}
      onPointerDown={(event) => { event.stopPropagation() }}
    >
      {isOpen && <MusicPanel id={panelId} opensDown={isAtTop} />}
      <button
        type="button"
        aria-label={isOpen ? 'Close the music player' : 'Open the music player'}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => { setIsOpen((open) => !open) }}
        style={{
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: '50%',
          border: border.medium,
          background: isOn ? color.yellow : color.white,
          color: color.ink,
          boxShadow: lift(3),
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          padding: 0,
          // Out of the way while a game is on: still there, but quiet.
          opacity: isGameUp && !isOpen ? 0.8 : 1,
          transition: 'opacity .2s, background .2s, transform .1s',
        }}
      >
        <NoteIcon isPlaying={isOn} />
      </button>
    </div>
  )
}

function MusicPanel({ id, opensDown }: { id: string; opensDown: boolean }) {
  const music = useBackgroundMusic()
  const isOn = music.isPlaying || music.isWaitingForGesture
  const volume = music.isMuted ? 0 : music.volume

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Music player"
      style={{
        position: 'absolute',
        left: 0,
        ...(opensDown ? { top: BUTTON_SIZE + 12 } : { bottom: BUTTON_SIZE + 12 }),
        width: 'min(300px, calc(100vw - 28px))',
        background: color.white,
        border: border.medium,
        borderRadius: 18,
        boxShadow: lift(5),
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: font.body,
        color: color.ink,
        animation: 'pa-pop .25s cubic-bezier(.34,1.56,.64,1)',
        transformOrigin: opensDown ? 'top left' : 'bottom left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: border.thin,
            background: color.yellowSoft,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <NoteIcon isPlaying={music.isPlaying} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...sharedStyles.microLabel, color: color.mutedStrong }}>
            {music.isWaitingForGesture ? 'STARTS ON YOUR FIRST CLICK' : music.isPlaying ? 'NOW PLAYING' : 'PAUSED'}
          </div>
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, ...sharedStyles.ellipsis }}>{TRACK_TITLE}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          type="range"
          aria-label="Position in the track"
          min={0}
          max={music.duration || 0}
          step={0.1}
          value={Math.min(music.currentTime, music.duration || 0)}
          disabled={!music.duration}
          onChange={(event) => { backgroundMusic.seek(Number(event.target.value)) }}
          style={slider(music.duration ? music.currentTime / music.duration : 0)}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: color.mutedStrong }}>
          <span>{clock(music.currentTime)}</span>
          <span>{music.duration ? clock(music.duration) : '–:––'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <RoundButton label="Back 10 seconds" onClick={() => { backgroundMusic.skip(-10) }}>
          <SkipIcon direction="back" />
        </RoundButton>
        <RoundButton label={isOn ? 'Pause' : 'Play'} onClick={() => { backgroundMusic.toggle() }} size={52} isPrimary>
          {isOn ? <PauseIcon /> : <PlayIcon />}
        </RoundButton>
        <RoundButton label="Forward 10 seconds" onClick={() => { backgroundMusic.skip(10) }}>
          <SkipIcon direction="forward" />
        </RoundButton>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          aria-label={music.isMuted ? 'Unmute' : 'Mute'}
          aria-pressed={music.isMuted}
          onClick={() => { backgroundMusic.toggleMute() }}
          style={{ ...iconButton, color: music.isMuted ? color.red : color.ink }}
        >
          <VolumeIcon level={volume} />
        </button>
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => { backgroundMusic.setVolume(Number(event.target.value)) }}
          style={{ ...slider(volume), flex: 1 }}
        />
        <span style={{ width: 38, textAlign: 'right', fontSize: 12, fontWeight: 800, color: color.mutedStrong }}>
          {Math.round(volume * 100)}%
        </span>
      </div>

      <SoundChannels />
    </div>
  )
}

/** What each sound channel is called, and the sample played on letting go of its slider, so the new level can be heard. */
const CHANNELS: { channel: Channel; label: string; name: string; sample: () => void }[] = [
  { channel: 'effects', label: 'SOUND EFFECTS', name: 'sound effects', sample: () => { sfx.ui.click() } },
  { channel: 'ambience', label: 'AMBIENCE · SEA, WIND, GULLS', name: 'ambient sounds', sample: () => { sfx.ambience.seagulls() } },
]

/** The sound channels' own volumes and mutes, under the music's. */
function SoundChannels() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10, borderTop: '2px dashed rgba(46, 42, 69, 0.15)' }}>
      {CHANNELS.map((entry) => <ChannelVolume key={entry.channel} {...entry} />)}
    </div>
  )
}

function ChannelVolume({ channel, label, name, sample }: (typeof CHANNELS)[number]) {
  const settings = useSfxSettings()[channel]
  const volume = settings.isMuted ? 0 : settings.volume

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ ...sharedStyles.microLabel, color: color.mutedStrong }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          aria-label={settings.isMuted ? `Unmute ${name}` : `Mute ${name}`}
          aria-pressed={settings.isMuted}
          onClick={() => {
            sfxEngine.toggleMute(channel)
            sfx.ui.toggle()
          }}
          style={{ ...iconButton, color: settings.isMuted ? color.red : color.ink }}
        >
          <VolumeIcon level={volume} />
        </button>
        <input
          type="range"
          aria-label={`${name[0]!.toUpperCase()}${name.slice(1)} volume`}
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => { sfxEngine.setVolume(Number(event.target.value), channel) }}
          onPointerUp={sample}
          style={{ ...slider(volume), flex: 1 }}
        />
        <span style={{ width: 38, textAlign: 'right', fontSize: 12, fontWeight: 800, color: color.mutedStrong }}>
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  )
}

function RoundButton({
  label,
  onClick,
  children,
  size = 40,
  isPrimary = false,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  size?: number
  isPrimary?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: border.thin,
        background: isPrimary ? color.pink : color.white,
        color: isPrimary ? color.white : color.ink,
        boxShadow: lift(isPrimary ? 3 : 2),
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {children}
    </button>
  )
}

const iconButton: CSSProperties = {
  width: 32,
  height: 32,
  border: 'none',
  background: 'transparent',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
}

/** A range input filled up to `fraction` in pink. */
const slider = (fraction: number): CSSProperties => {
  const percent = `${Math.min(1, Math.max(0, fraction)) * 100}%`
  return {
    width: '100%',
    height: 8,
    margin: 0,
    borderRadius: 999,
    border: `2px solid ${color.ink}`,
    appearance: 'none',
    WebkitAppearance: 'none',
    background: `linear-gradient(90deg, ${color.pink} ${percent}, ${color.panel} ${percent})`,
    accentColor: color.pink,
    cursor: 'pointer',
  }
}

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/* ---------------- icons ---------------- */

const svg = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const
const stroke = { stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** A pair of quavers; sound waves beside them while it plays. */
function NoteIcon({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg {...svg}>
      <path d="M9 18V5l10-2v13" {...stroke} />
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
      {!isPlaying && <path d="M3 3l18 18" {...stroke} stroke={color.red} />}
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg {...svg}>
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg {...svg}>
      <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    </svg>
  )
}

function SkipIcon({ direction }: { direction: 'back' | 'forward' }) {
  return (
    <svg {...svg} width={20} height={20} style={{ transform: direction === 'forward' ? 'scaleX(-1)' : undefined }}>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" {...stroke} />
      <path d="M4 4v4h4" {...stroke} />
    </svg>
  )
}

function VolumeIcon({ level }: { level: number }) {
  return (
    <svg {...svg}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      {level === 0 ? (
        <path d="M16 9.5l5 5M21 9.5l-5 5" {...stroke} />
      ) : (
        <>
          <path d="M15.5 9a4 4 0 0 1 0 6" {...stroke} />
          {level > 0.5 && <path d="M18.5 6.5a8 8 0 0 1 0 11" {...stroke} />}
        </>
      )}
    </svg>
  )
}
