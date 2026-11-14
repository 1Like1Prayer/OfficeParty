import type { CSSProperties, ReactNode } from 'react'
import { border, color, fluid, font } from '../../../theme/index.ts'

export type PillVariant = 'round' | 'tag' | 'outline'

interface PillProps {
  children: ReactNode
  variant?: PillVariant
}

const VARIANTS: Record<PillVariant, CSSProperties> = {
  /** Phase indicator in the header. */
  round: {
    background: color.white,
    padding: `${fluid(5, 8)} ${fluid(12, 18)}`,
    fontFamily: font.display,
    fontWeight: 600,
    fontSize: fluid(13, 17),
  },
  /** Filled metadata chip on the reveal screen. */
  tag: {
    background: color.white,
    padding: `${fluid(7, 9)} ${fluid(12, 18)}`,
    fontWeight: 900,
    fontSize: fluid(11, 13),
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
        whiteSpace: 'nowrap',
        ...VARIANTS[variant],
      }}
    >
      {children}
    </div>
  )
}
