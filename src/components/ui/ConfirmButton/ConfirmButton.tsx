import { useEffect, useState, type CSSProperties } from 'react'
import { useHover } from '../../../hooks/index.ts'
import { border, color, font, lift } from '../../../theme/index.ts'

export type ConfirmButtonTone = 'light' | 'danger'

interface ConfirmButtonProps {
  /** What the button says at rest. */
  label: string
  /** What it says once armed; a second press within ARM_MS confirms. */
  confirmLabel: string
  onConfirm: () => void
  /** Accessible name when `label` is only a symbol. */
  title?: string
  tone?: ConfirmButtonTone
  /** A tiny round badge, as on an avatar. */
  badge?: boolean
  style?: CSSProperties
}

/** How long an armed button waits for the second press. */
const ARM_MS = 3000

const TONES: Record<ConfirmButtonTone, { rest: CSSProperties; armed: CSSProperties }> = {
  light: {
    rest: { background: color.white, color: color.ink },
    armed: { background: color.red, color: color.white },
  },
  danger: {
    rest: { background: color.pinkSoft, color: color.ink },
    armed: { background: color.red, color: color.white },
  },
}

/**
 * A small button for actions that can't be undone: the first press arms it,
 * the second carries it out. No browser dialog, so a game on screen keeps running.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  title,
  tone = 'light',
  badge = false,
  style,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false)
  const [hovered, hoverHandlers] = useHover()

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => { setArmed(false) }, ARM_MS)
    return () => { clearTimeout(timer) }
  }, [armed])

  const shape: CSSProperties = badge && !armed
    ? { width: 24, height: 24, padding: 0, fontSize: 14, lineHeight: '18px' }
    : { padding: '5px 12px', fontSize: 13, lineHeight: 1.2 }

  return (
    <button
      type="button"
      title={armed ? confirmLabel : (title ?? label)}
      aria-label={armed ? confirmLabel : (title ?? label)}
      onClick={(event) => {
        event.stopPropagation()
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
      {...hoverHandlers}
      style={{
        ...TONES[tone][armed ? 'armed' : 'rest'],
        ...shape,
        border: border.thin,
        borderRadius: 999,
        fontFamily: font.display,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        boxShadow: lift(hovered ? 1 : 3),
        transform: hovered ? 'translateY(2px)' : 'none',
        transition: 'transform .1s ease, box-shadow .1s ease, background .15s ease',
        ...style,
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
