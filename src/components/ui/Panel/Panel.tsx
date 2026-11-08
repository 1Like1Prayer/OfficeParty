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
        // Only emit the longhand when there is an accent: React writes an
        // `undefined` style value as '', which would clear the left border the
        // shorthand just set and leave the panel open on that side.
        ...(accent ? { borderLeft: `12px solid ${accent}` } : {}),
        borderRadius: radius,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
