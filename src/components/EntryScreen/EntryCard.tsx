import type { ReactNode } from 'react'
import { border, color, fluid, lift, sharedStyles } from '../../theme/index.ts'

interface EntryCardProps {
  label: string
  onBack: () => void
  children: ReactNode
}

/** The raised card both entrance screens live in. */
export function EntryCard({ label, onBack, children }: EntryCardProps) {
  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        padding: `${fluid(20, 40)} ${fluid(16, 52)}`,
        animation: 'pa-pop .4s cubic-bezier(.34,1.56,.64,1)',
      }}
    >
      <div
        style={{
          width: 460,
          maxWidth: '100%',
          // Auto margins centre the card, but unlike centring the section they
          // let it scroll from its top when the screen is shorter than the card.
          margin: 'auto',
          background: color.white,
          border: border.heavy,
          borderRadius: fluid(22, 28),
          boxShadow: lift(10),
          padding: `${fluid(20, 30)} ${fluid(18, 30)} ${fluid(24, 34)}`,
          display: 'flex',
          flexDirection: 'column',
          gap: fluid(14, 18),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={sharedStyles.microLabel}>{label}</div>
          <button type="button" onClick={onBack} style={sharedStyles.inlineAction}>
            BACK
          </button>
        </div>
        {children}
      </div>
    </section>
  )
}
