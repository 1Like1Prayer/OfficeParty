import { LOG_DODGE } from '../../shared/games/logDodge/constants.ts'
import type { Action } from '../../shared/games/logDodge/types.ts'
import { useMediaQuery } from '../../hooks/index.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import { ACTION_INFO, ACTION_ORDER } from './controls.ts'

/** A finger rather than a mouse: the move buttons are the controller, so they are made big. */
const TOUCH = '(pointer: coarse)'

/** How long a key stays lit after being pressed. */
const PRESSED_MS = 220

const HEART_ON = '#FF5FA2'
const HEART_OFF = '#4a3f78'

interface HudProps {
  /** Milliseconds into the round; negative before it starts. */
  elapsedMs: number
  durationMs: number
  hits: number
  isOut: boolean
  /** Spectators see the lives and the clock but have no keys to press. */
  hasKeys: boolean
  /** Presses a move, from a tap or click on its button; null while moves are not taken. */
  onPress: ((action: Action) => void) | null
  lastPress: { action: Action; atMs: number } | null
  /** When the next press will be taken, in ms into the round. */
  readyAtMs: number
  message: string | null
}

const formatClock = (ms: number): string => {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Everything drawn over the stage: the clock, the lives, the move buttons —
 * a reminder of the keys at a desk, the controller on a phone — and what to
 * say when the round is over. Nothing here says which
 * move the next log wants — reading that off the log is the game.
 */
export function Hud({
  elapsedMs,
  durationMs,
  hits,
  isOut,
  hasKeys,
  onPress,
  lastPress,
  readyAtMs,
  message,
}: HudProps) {
  const touch = useMediaQuery(TOUCH)
  const remainingMs = durationMs - Math.max(0, elapsedMs)
  const lives = Math.max(0, LOG_DODGE.MAX_HITS - hits)
  const cooldownFill = Math.min(1, Math.max(0, 1 - (readyAtMs - elapsedMs) / LOG_DODGE.INPUT_COOLDOWN_MS))

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '22px 24px 26px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 18 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...sharedStyles.microLabel, color: color.mutedSoft }}>TIME</div>
          <div
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 34,
              lineHeight: 1,
              color: remainingMs < 10_000 ? color.pink : color.cream,
              textShadow: `0 2px 0 ${color.ink}`,
            }}
          >
            {formatClock(remainingMs)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...sharedStyles.microLabel, color: color.mutedSoft }}>LIVES</div>
          <div style={{ display: 'flex', gap: 4, fontSize: 32, lineHeight: 1 }}>
            {Array.from({ length: LOG_DODGE.MAX_HITS }, (_, index) => (
              <span
                key={index}
                style={{
                  color: index < lives ? HEART_ON : HEART_OFF,
                  textShadow: `0 2px 0 ${color.ink}`,
                  transition: 'color .15s',
                  animation: index === lives && hits > 0 ? 'pa-pop .35s ease-out' : undefined,
                }}
              >
                ♥
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {message !== null && (
          <div
            key={message}
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 30,
              color: isOut ? '#FF7A72' : color.green,
              textShadow: `0 3px 0 ${color.ink}`,
              animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
              textAlign: 'center',
            }}
          >
            {message}
          </div>
        )}

        {hasKeys && (
          <>
            <div
              style={{
                display: 'flex',
                gap: touch ? 14 : 8,
                opacity: isOut ? 0.4 : touch ? 0.95 : 0.85,
                // The rest of the HUD lets clicks through to the stage; the buttons take them.
                pointerEvents: onPress ? 'auto' : 'none',
              }}
            >
              {ACTION_ORDER.map((action) => {
                const info = ACTION_INFO[action]
                const isPressed =
                  lastPress?.action === action && elapsedMs - lastPress.atMs < PRESSED_MS
                return (
                  <button
                    key={action}
                    type="button"
                    aria-label={info.label}
                    disabled={!onPress}
                    // Never focused, so Space and Enter go to the game's own keys
                    // rather than clicking whichever button was tapped last.
                    tabIndex={-1}
                    // On the way down, not on release: a dodge is all timing, and a
                    // click waits for the finger to lift.
                    onPointerDown={(event) => {
                      event.preventDefault()
                      onPress?.(action)
                    }}
                    style={{
                      minWidth: touch ? 112 : 72,
                      padding: touch ? '12px 18px 13px' : '4px 10px 5px',
                      borderRadius: touch ? 18 : 12,
                      border: `${touch ? 3 : 2}px solid ${color.ink}`,
                      background: isPressed ? color.cream : 'rgba(46, 42, 69, 0.55)',
                      color: isPressed ? color.ink : color.cream,
                      textAlign: 'center',
                      font: 'inherit',
                      cursor: onPress ? 'pointer' : 'default',
                      touchAction: 'manipulation',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      transform: isPressed ? 'translateY(2px)' : 'none',
                      transition: 'background .08s, color .08s, transform .08s',
                    }}
                  >
                    <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: touch ? 30 : 18, lineHeight: 1.1 }}>
                      {info.glyph}
                    </div>
                    <div style={{ ...sharedStyles.microLabel, fontSize: touch ? 13 : 10, color: 'inherit', opacity: 0.8 }}>
                      {info.label.toUpperCase()}
                    </div>
                  </button>
                )
              })}
            </div>
            {/* Fills as the cooldown ends: a press before it is full is ignored. */}
            <div
              style={{
                width: 240,
                maxWidth: '70%',
                height: 5,
                borderRadius: 3,
                background: 'rgba(46, 42, 69, 0.35)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${cooldownFill * 100}%`,
                  background: cooldownFill >= 1 ? color.cream : color.mutedSoft,
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
