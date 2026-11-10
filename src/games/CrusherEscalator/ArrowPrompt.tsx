import { color } from '../../theme/index.ts'
import type { Direction } from '../../shared/games/crusherEscalator/types.ts'

export type PressFeedback = 'correct' | 'wrong'

interface ArrowPromptProps {
  /** The arrow to press, or null while there is nothing to press. */
  direction: Direction | null
  /** Shows the arrow that was just pressed in green (right) or red (wrong). */
  feedback: PressFeedback | null
}

const SIZE = 92
const CORRECT_COLOR = '#16B364'

const ROTATION_DEGREES: Record<Direction, number> = { up: 0, right: 90, down: 180, left: 270 }

const COLOR_BY_FEEDBACK: Record<PressFeedback, string> = {
  correct: CORRECT_COLOR,
  wrong: color.red,
}

/** An up arrow's shape; the other directions are this, turned. */
const ARROW_OUTLINE = '50,6 94,52 68,52 68,94 32,94 32,52 6,52'

/**
 * The arrow to press: solid, always in the same spot, and only ever the
 * current one. A press turns the whole arrow green or red for a moment, and then the next
 * arrow takes its place without moving.
 */
export function ArrowPrompt({ direction, feedback }: ArrowPromptProps) {
  const arrowColor = feedback === null ? color.cream : COLOR_BY_FEEDBACK[feedback]

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 100 100"
      role="img"
      aria-label={direction === null ? 'Get ready' : `Press ${direction}`}
      style={{
        display: 'block',
        overflow: 'visible',
        filter: feedback === null ? undefined : `drop-shadow(0 0 10px ${arrowColor})`,
      }}
    >
      {direction !== null && (
        <polygon
          points={ARROW_OUTLINE}
          fill={arrowColor}
          stroke={arrowColor}
          strokeWidth={5}
          strokeLinejoin="round"
          transform={`rotate(${ROTATION_DEGREES[direction]} 50 50)`}
        />
      )}
    </svg>
  )
}
