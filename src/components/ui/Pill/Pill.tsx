import type { CSSProperties, ReactNode } from 'react'
import { border, color, font } from '../../../theme/index.ts'

export type PillVariant = 'round' | 'tag' | 'outline'

interface PillProps {
  children: ReactNode
  variant?: PillVariant
}

const VARIANTS: Record<PillVariant, CSSProperties> = {
  /** Phase indicator in the header. */
  round: {
    background: color.white,
    padding: '8px 18px',
    fontFamily: font.display,
    fontWeight: 600,
    fontSize: 17,
  },
  /** Filled metadata chip on the reveal screen. */
  tag: {
    background: color.white,
    padding: '9px 18px',
    fontWeight: 900,
    fontSize: 13,
  },
  /** Hollow chip on the lobby screen. */
  outline: {
    background: 'transparent',
    padding: '7px 14px',
    fontWeight: 900,
    fontSize: 12,
    color: color.muted,
  },
}

export function Pill({ children, variant = 'tag' }: PillProps) {
  return (
    <div
      style={{
        borderRadius: 999,
        border: border.medium,
        letterSpacing: '0.12em',
        ...VARIANTS[variant],
      }}
    >
      {children}
    </div>
  )
}
