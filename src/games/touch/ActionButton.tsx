import { color, font } from '../../theme/index.ts'

const SIZE = 92

interface ActionButtonProps {
  label: string
  enabled: boolean
  onPress: () => void
  /** The button's colour when it can be pressed. */
  tone: string
  /** How charged it is, 0 to 1, drawn as a ring that fills round it; left out, there is no ring. */
  charge?: number
}

/**
 * A big round button for the right thumb — Minefield's sonar, Hex Drop's jump.
 * It fires as the finger lands, not as it lifts: a press is timing.
 */
export function ActionButton({ label, enabled, onPress, tone, charge }: ActionButtonProps) {
  const isReady = charge === undefined || charge >= 1
  const ring = SIZE + 12
  return (
    <div style={{ position: 'relative', width: ring, height: ring, pointerEvents: 'none' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            charge === undefined
              ? 'rgba(46, 42, 69, 0.35)'
              : `conic-gradient(${isReady ? tone : color.mutedSoft} ${charge * 360}deg, rgba(46, 42, 69, 0.35) 0)`,
          border: `3px solid ${color.ink}`,
        }}
      />
      <button
        type="button"
        aria-label={label}
        disabled={!enabled}
        tabIndex={-1}
        onPointerDown={(event) => {
          event.preventDefault()
          onPress()
        }}
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          width: SIZE,
          height: SIZE,
          borderRadius: '50%',
          border: `3px solid ${color.ink}`,
          background: isReady ? tone : 'rgba(74, 68, 104, 0.9)',
          boxShadow: `0 4px 0 ${color.ink}`,
          color: color.cream,
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          pointerEvents: 'auto',
          touchAction: 'manipulation',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          cursor: enabled ? 'pointer' : 'default',
          transition: 'background .15s',
        }}
      >
        {label}
      </button>
    </div>
  )
}
