import { useRef, useState, type PointerEvent } from 'react'
import type { Axis } from '../../shared/games/minefield/types.ts'
import { color, font } from '../../theme/index.ts'

const STICK_SIZE = 128
const KNOB_SIZE = 54
/** How far the knob can travel from the centre, in pixels. */
const REACH = (STICK_SIZE - KNOB_SIZE) / 2
/** Inside this share of the reach the stick counts as let go, so a resting thumb does not wander. */
const DEAD_ZONE = 0.28
/**
 * A direction counts on an axis once the push leans this far toward it
 * (sin 22.5°), which splits the circle into eight even slices.
 */
const AXIS_LEAN = 0.38
const SONAR_SIZE = 92
const SONAR_COLOR = '#3fb8e0'

interface TouchControlsProps {
  /** Moves and sonar are taken. Off, the controls stay on screen, dimmed. */
  enabled: boolean
  onMove: (dx: Axis, dy: Axis) => void
  onSonar: () => void
  /** How charged the sonar is, 0 to 1; it can be sent again at 1. */
  sonarCharge: number
}

/**
 * A phone's controller for Minefield: a joystick under the left thumb for
 * walking in eight directions, and a sonar button under the right. They sit
 * in the bottom corners, clear of the middle of the field where the runner is.
 * Both send exactly what the keys would, so the server sees no difference.
 */
export function TouchControls({ enabled, onMove, onSonar, sonarCharge }: TouchControlsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        // Clear of the home bar and the notch, which a full-screen page reaches under.
        padding:
          '0 max(18px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left))',
        pointerEvents: 'none',
        opacity: enabled ? 1 : 0.45,
        transition: 'opacity .2s',
      }}
    >
      <Joystick enabled={enabled} onMove={onMove} />
      <SonarButton enabled={enabled} onSonar={onSonar} charge={sonarCharge} />
    </div>
  )
}

function Joystick({ enabled, onMove }: { enabled: boolean; onMove: (dx: Axis, dy: Axis) => void }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const pointerId = useRef<number | null>(null)
  const sent = useRef({ dx: 0 as Axis, dy: 0 as Axis })
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [isHeld, setIsHeld] = useState(false)

  const send = (dx: Axis, dy: Axis) => {
    if (dx === sent.current.dx && dy === sent.current.dy) return
    sent.current = { dx, dy }
    onMove(dx, dy)
  }

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const base = baseRef.current
    if (base === null) return
    const box = base.getBoundingClientRect()
    let x = event.clientX - (box.left + box.width / 2)
    let y = event.clientY - (box.top + box.height / 2)
    const distance = Math.hypot(x, y)
    if (distance > REACH) {
      x = (x / distance) * REACH
      y = (y / distance) * REACH
    }
    setKnob({ x, y })
    if (distance < REACH * DEAD_ZONE) {
      send(0, 0)
      return
    }
    // Screen up is up the field, as the arrow keys have it.
    const axis = (value: number): Axis => (value > AXIS_LEAN ? 1 : value < -AXIS_LEAN ? -1 : 0)
    send(axis(x / distance), axis(y / distance))
  }

  const release = () => {
    pointerId.current = null
    setIsHeld(false)
    setKnob({ x: 0, y: 0 })
    send(0, 0)
  }

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Move"
      onPointerDown={(event) => {
        if (!enabled || pointerId.current !== null) return
        event.preventDefault()
        pointerId.current = event.pointerId
        setIsHeld(true)
        event.currentTarget.setPointerCapture(event.pointerId)
        follow(event)
      }}
      onPointerMove={(event) => {
        if (event.pointerId === pointerId.current) follow(event)
      }}
      onPointerUp={(event) => {
        if (event.pointerId === pointerId.current) release()
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === pointerId.current) release()
      }}
      style={{
        position: 'relative',
        width: STICK_SIZE,
        height: STICK_SIZE,
        borderRadius: '50%',
        background: 'rgba(46, 42, 69, 0.35)',
        border: `3px solid ${color.ink}`,
        boxShadow: 'inset 0 4px 10px rgba(0, 0, 0, 0.25)',
        pointerEvents: 'auto',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Faint arrows round the rim, so it reads as a stick at a glance. */}
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
          // Springs back to the middle when let go; follows the thumb exactly while held.
          transition: isHeld ? 'none' : 'transform .15s ease-out',
        }}
      />
    </div>
  )
}

function SonarButton({ enabled, onSonar, charge }: { enabled: boolean; onSonar: () => void; charge: number }) {
  const isReady = charge >= 1
  const ring = SONAR_SIZE + 12
  return (
    <div style={{ position: 'relative', width: ring, height: ring, pointerEvents: 'none' }}>
      {/* The charge, filling round the button. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `conic-gradient(${isReady ? SONAR_COLOR : color.mutedSoft} ${charge * 360}deg, rgba(46, 42, 69, 0.35) 0)`,
          border: `3px solid ${color.ink}`,
        }}
      />
      <button
        type="button"
        aria-label="Sonar"
        disabled={!enabled}
        tabIndex={-1}
        // On the way down: a press is timing.
        onPointerDown={(event) => {
          event.preventDefault()
          onSonar()
        }}
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          width: SONAR_SIZE,
          height: SONAR_SIZE,
          borderRadius: '50%',
          border: `3px solid ${color.ink}`,
          background: isReady ? SONAR_COLOR : 'rgba(74, 68, 104, 0.9)',
          boxShadow: `0 4px 0 ${color.ink}`,
          color: color.cream,
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.04em',
          pointerEvents: 'auto',
          touchAction: 'manipulation',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          cursor: enabled ? 'pointer' : 'default',
          transition: 'background .15s',
        }}
      >
        SONAR
      </button>
    </div>
  )
}
