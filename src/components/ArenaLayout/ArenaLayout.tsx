import type { ReactNode } from 'react'
import { color, font } from '../../theme/index.ts'
import { StripeBar } from '../ui/index.ts'
import { ArenaHeader } from './ArenaHeader.tsx'

interface ArenaLayoutProps {
  roundLabel: string
  /** The active phase screen. */
  children: ReactNode
  /** Persistent right-hand rail, normally the scoreboard. */
  aside?: ReactNode
}

/** Full-screen chrome: stripe, header, phase pane and the scoreboard rail. */
export function ArenaLayout({ roundLabel, children, aside }: ArenaLayoutProps) {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: color.cream,
        color: color.ink,
        fontFamily: font.body,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <StripeBar />
      <ArenaHeader roundLabel={roundLabel} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {children}
        </div>
        {aside}
      </div>
    </div>
  )
}
