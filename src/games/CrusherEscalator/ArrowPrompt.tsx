import { color } from '../../theme/index.ts'
import type { Direction } from '../../shared/games/crusherEscalator/types.ts'
import { ARROW_OUTLINE, CORRECT_COLOR, ROTATION_DEGREES } from './arrowShape.ts'

export type PressFeedback = 'correct' | 'wrong'

interface ArrowPromptProps {
  /** The arrow to press, or null while there is nothing to press. */
  direction: Direction | null
  /** Shows the arrow that was just pressed in green (right) or red (wrong). */
  feedback: PressFeedback | null
  /** How big it is drawn, as any CSS length; it shrinks on a short screen. */
  size?: string
}

const COLOR_BY_FEEDBACK: Record<PressFeedback, string> = {
  correct: CORRECT_COLOR,
  wrong: color.red,
}

/**
 * The arrow to press: solid, always in the same spot, and only ever the
 * current one. A press turns the whole arrow green or red for a moment, and then the next
 * arrow takes its place without moving.
 */
export function ArrowPrompt({ direction, feedback, size = '92px' }: ArrowPromptProps) {
  const arrowColor = feedback === null ? color.cream : COLOR_BY_FEEDBACK[feedback]

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={direction === null ? 'Get ready' : `Press ${direction}`}
      style={{
        display: 'block',
        width: size,
        height: size,
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
