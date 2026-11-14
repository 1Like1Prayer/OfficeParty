import type { CSSProperties } from 'react'
import type { Direction } from '../../shared/games/crusherEscalator/types.ts'
import { color, font } from '../../theme/index.ts'
import type { PressFeedback } from './ArrowPrompt.tsx'
import { CORRECT_COLOR } from './arrowShape.ts'
import { DIRECTION_GLYPH } from './controls.ts'

/** Left to right as a dance mat has them, so each thumb keeps to its own half: ← ↑ for the left, ↓ → for the right. */
const ORDER: readonly Direction[] = ['left', 'up', 'down', 'right']

/** The same deep space as the scene, so the pad reads as part of it. */
const BACKDROP_COLOR = '#0a051c'

interface ArrowPadProps {
  /**
   * `row`: all four along the foot of the screen, for a phone held upright.
   * `left` / `right`: that half of them stacked down one side, for a phone
   * held sideways, where height is too short to spare.
   */
  placement: 'row' | 'left' | 'right'
  /** Presses an arrow; null while presses are not taken. */
  onPress: ((direction: Direction) => void) | null
  /** The arrow just pressed and how it went, lit for as long as the prompt shows it. */
  flash: { direction: Direction; feedback: PressFeedback } | null
}

/**
 * The phone's controller: big arrow buttons in a strip of their own beside the
 * arena, never over it, so a thumb never hides a runner or the hole. They fire
 * as the finger lands, not as it lifts — a press is all timing.
 */
export function ArrowPad({ placement, onPress, flash }: ArrowPadProps) {
  const directions =
    placement === 'row' ? ORDER : placement === 'left' ? ORDER.slice(0, 2) : ORDER.slice(2)
  const isRow = placement === 'row'

  const strip: CSSProperties = {
    flexShrink: 0,
    display: 'flex',
    flexDirection: isRow ? 'row' : 'column',
    gap: 10,
    background: BACKDROP_COLOR,
    // Clear of the home bar and the notch, which a full-screen page reaches under.
    padding: isRow
      ? '10px max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))'
      : placement === 'left'
        ? '12px 10px max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))'
        : '12px max(10px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) 10px',
    ...(isRow
      ? { borderTop: `3px solid ${color.ink}` }
      : placement === 'left'
        ? { borderRight: `3px solid ${color.ink}`, width: 96 }
        : { borderLeft: `3px solid ${color.ink}`, width: 96 }),
  }

  return (
    <div style={strip}>
      {directions.map((direction) => {
        const lit = flash?.direction === direction
        const tone = flash?.feedback === 'correct' ? CORRECT_COLOR : color.red
        return (
          <button
            key={direction}
            type="button"
            aria-label={direction}
            disabled={onPress === null}
            // Never focused, so a keyboard press is never sent to a button tapped earlier.
            tabIndex={-1}
            onPointerDown={(event) => {
              event.preventDefault()
              onPress?.(direction)
            }}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: isRow ? 64 : 0,
              borderRadius: 16,
              border: `3px solid ${color.ink}`,
              background: lit ? tone : 'rgba(74, 68, 104, 0.85)',
              boxShadow: lit ? `0 0 14px ${tone}` : `inset 0 -4px 0 rgba(0, 0, 0, 0.35)`,
              color: color.cream,
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 'clamp(26px, 7vmin, 40px)',
              lineHeight: 1,
              cursor: onPress === null ? 'default' : 'pointer',
              touchAction: 'manipulation',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              transform: lit ? 'translateY(2px)' : 'none',
              // Only the buttons dim while presses are not taken; the strip stays dark.
              opacity: onPress === null ? 0.45 : 1,
              transition: 'background .08s, transform .08s, box-shadow .08s, opacity .2s',
            }}
          >
            {DIRECTION_GLYPH[direction]}
          </button>
        )
      })}
    </div>
  )
}
