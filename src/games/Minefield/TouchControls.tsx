import { useRef } from 'react'
import type { Axis } from '../../shared/games/minefield/types.ts'
import { ActionButton } from '../touch/ActionButton.tsx'
import { Joystick, type StickVector } from '../touch/Joystick.tsx'
import { TouchBar } from '../touch/TouchBar.tsx'

const SONAR_COLOR = '#3fb8e0'
/** Each of the eight directions owns a 45° slice of the circle. */
const SLICE = Math.PI / 4
/**
 * Once in a direction, the stick has to swing this far past the slice's edge
 * before it changes, so a thumb resting near a diagonal does not flicker
 * between two directions.
 */
const HYSTERESIS = (10 * Math.PI) / 180

interface TouchControlsProps {
  /** Moves and sonar are taken. Off, the controls stay on screen, dimmed. */
  enabled: boolean
  /** The stick's direction, on screen axes like the arrow keys: x right, y down. */
  onMove: (dx: Axis, dy: Axis) => void
  onSonar: () => void
  /** How charged the sonar is, 0 to 1; it can be sent again at 1. */
  sonarCharge: number
}

/**
 * A phone's controller for Minefield: the sonar under the left thumb, the
 * stick under the right. A runner moves in eight directions, so the stick's
 * exact angle is snapped to the nearest of them, and held there until the
 * thumb clearly means another.
 */
export function TouchControls({ enabled, onMove, onSonar, sonarCharge }: TouchControlsProps) {
  /** The slice the stick is in, 0 (right) round to 7, or null when let go. */
  const slice = useRef<number | null>(null)

  const steer = ({ x, y }: StickVector) => {
    if (x === 0 && y === 0) {
      if (slice.current !== null) {
        slice.current = null
        onMove(0, 0)
      }
      return
    }
    const angle = Math.atan2(y, x)
    const current = slice.current
    if (current !== null) {
      // How far the stick is from the middle of the slice it is in, either way round.
      const offset = Math.abs(Math.atan2(Math.sin(angle - current * SLICE), Math.cos(angle - current * SLICE)))
      if (offset <= SLICE / 2 + HYSTERESIS) return
    }
    const next = ((Math.round(angle / SLICE) % 8) + 8) % 8
    if (next === current) return
    slice.current = next
    const toAxis = (value: number): Axis => (value > 0.5 ? 1 : value < -0.5 ? -1 : 0)
    onMove(toAxis(Math.cos(next * SLICE)), toAxis(Math.sin(next * SLICE)))
  }

  return (
    <TouchBar
      enabled={enabled}
      stick={<Joystick enabled={enabled} onChange={steer} />}
      action={<ActionButton label="Sonar" enabled={enabled} onPress={onSonar} tone={SONAR_COLOR} charge={sonarCharge} />}
    />
  )
}
