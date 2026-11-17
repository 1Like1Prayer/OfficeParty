import { useRef, useState } from 'react'
import { color, font } from '../../theme/index.ts'

const STICK_SIZE = 140
const KNOB_SIZE = 56
/** How far the knob can travel from the centre, in pixels. */
const REACH = (STICK_SIZE - KNOB_SIZE) / 2
/** Inside this share of the reach the stick counts as let go: small, so a light touch already steers. */
const DEAD_ZONE = 0.15
/** Where the stick rests, from the bottom-right corner of its zone, clear of the home bar and notch. */
const REST_INSET = 'max(18px, env(safe-area-inset-right))'
const REST_INSET_BOTTOM = 'max(18px, env(safe-area-inset-bottom))'

/** Where the stick points, on screen axes: x to the right, y down, each -1 to 1. Both 0 when let go. */
export interface StickVector {
  x: number
  y: number
}

interface JoystickProps {
  enabled: boolean
  /** Every change of where the stick points, while held and when let go. */
  onChange: (vector: StickVector) => void
}

/**
 * An analog thumb-stick that floats: it fills its parent with a touch zone
 * and rests in the zone's bottom-right corner, but a thumb put down anywhere
 * in the zone brings the stick to it, centred there, and the push is measured
 * from that spot. Let go, it goes back to rest.
 *
 * It reports the exact direction it is pushed, and how far, as a vector. Past
 * a small dead zone the push is rescaled to run from 0 at the dead zone's
 * edge to 1 at the rim, so steering is smooth from the first millimetre. It
 * follows the thumb anywhere once pressed, even out of the zone.
 */
export function Joystick({ enabled, onChange }: JoystickProps) {
  const pointerId = useRef<number | null>(null)
  /** The stick's middle while held, in client pixels. */
  const origin = useRef({ x: 0, y: 0 })
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  /** Where the stick is drawn while held, its middle in pixels from the zone's top-left; null at rest. */
  const [placed, setPlaced] = useState<{ x: number; y: number } | null>(null)
  const isHeld = placed !== null

  const follow = (clientX: number, clientY: number) => {
    let x = clientX - origin.current.x
    let y = clientY - origin.current.y
    const distance = Math.hypot(x, y)
    if (distance > REACH) {
      x = (x / distance) * REACH
      y = (y / distance) * REACH
    }
    setKnob({ x, y })
    const push = Math.min(1, distance / REACH)
    if (push < DEAD_ZONE || distance === 0) {
      onChange({ x: 0, y: 0 })
      return
    }
    const strength = (push - DEAD_ZONE) / (1 - DEAD_ZONE)
    onChange({ x: (x / Math.hypot(x, y)) * strength, y: (y / Math.hypot(x, y)) * strength })
  }

  const release = () => {
    pointerId.current = null
    setPlaced(null)
    setKnob({ x: 0, y: 0 })
    onChange({ x: 0, y: 0 })
  }

  return (
    <div
      role="application"
      aria-label="Move"
      onPointerDown={(event) => {
        if (!enabled || pointerId.current !== null) return
        event.preventDefault()
        pointerId.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        // The stick comes to the thumb, centred right under it, so landing is no push at all.
        const zone = event.currentTarget.getBoundingClientRect()
        origin.current = { x: event.clientX, y: event.clientY }
        setPlaced({ x: event.clientX - zone.left, y: event.clientY - zone.top })
        follow(event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (event.pointerId === pointerId.current) follow(event.clientX, event.clientY)
      }}
      onPointerUp={(event) => {
        if (event.pointerId === pointerId.current) release()
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === pointerId.current) release()
      }}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: STICK_SIZE,
          height: STICK_SIZE,
          ...(placed === null
            ? { right: REST_INSET, bottom: REST_INSET_BOTTOM }
            : { left: placed.x - STICK_SIZE / 2, top: placed.y - STICK_SIZE / 2 }),
          borderRadius: '50%',
          background: 'rgba(46, 42, 69, 0.35)',
          border: `3px solid ${color.ink}`,
          boxShadow: 'inset 0 4px 10px rgba(0, 0, 0, 0.25)',
          pointerEvents: 'none',
        }}
      >
        {/* The dead zone, faintly, so it is clear how little a push it takes. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: REACH * 2 * DEAD_ZONE + KNOB_SIZE * 0.3,
            height: REACH * 2 * DEAD_ZONE + KNOB_SIZE * 0.3,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1px dashed rgba(255, 241, 208, 0.35)',
          }}
        />
        {(['↑', '→', '↓', '←'] as const).map((glyph, index) => (
          <span
            key={glyph}
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) rotate(${index * 90}deg) translateY(${-STICK_SIZE / 2 + 13}px) rotate(${-index * 90}deg)`,
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 14,
              color: color.cream,
              opacity: 0.7,
            }}
          >
            {glyph}
          </span>
        ))}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            marginLeft: -KNOB_SIZE / 2,
            marginTop: -KNOB_SIZE / 2,
            borderRadius: '50%',
            background: color.cream,
            border: `3px solid ${color.ink}`,
            boxShadow: `0 4px 0 ${color.ink}`,
            transform: `translate(${knob.x}px, ${knob.y}px)`,
            // Follows the thumb exactly while held; springs back when let go.
            transition: isHeld ? 'none' : 'transform .15s ease-out',
          }}
        />
      </div>
    </div>
  )
}
