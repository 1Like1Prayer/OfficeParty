import type { ReactNode } from 'react'
import { border, color, lift, sharedStyles } from '../../theme/index.ts'

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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 52px',
        animation: 'pa-pop .4s cubic-bezier(.34,1.56,.64,1)',
      }}
    >
      <div
        style={{
          width: 460,
          maxWidth: '100%',
          background: color.white,
          border: border.heavy,
          borderRadius: 28,
          boxShadow: lift(10),
          padding: '30px 30px 34px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
