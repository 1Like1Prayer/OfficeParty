import type { CSSProperties, ReactNode } from 'react'
import { border, color } from '../../../theme/index.ts'

interface PanelProps {
  children: ReactNode
  /** Thick coloured left edge, as on the rules card. */
  accent?: string
  radius?: number
  background?: string
  style?: CSSProperties
}

/** White outlined card — the shared shell for rules, rows and callouts. */
export function Panel({
  children,
  accent,
  radius = 18,
  background = color.white,
  style,
}: PanelProps) {
  return (
    <div
      style={{
        background,
        border: border.medium,
        borderLeft: accent ? `12px solid ${accent}` : undefined,
        borderRadius: radius,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
