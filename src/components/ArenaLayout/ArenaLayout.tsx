import type { ReactNode } from 'react'
import { useMediaQuery } from '../../hooks/index.ts'
import { breakpoint, color, font } from '../../theme/index.ts'
import { ArenaHeader } from './ArenaHeader.tsx'
import { ArenaNotice } from './ArenaNotice.tsx'

interface ArenaLayoutProps {
  roundLabel: string
  /** The title, join and play screens run without the header. */
  showHeader: boolean
  /** A rejected action, shown without tearing the arena down. */
  notice?: string | null
  /** The active screen. */
  children: ReactNode
  /** Persistent right-hand rail, normally the scoreboard. */
  aside?: ReactNode | false
}

/** Full-screen chrome: stripe, header, phase pane and the scoreboard rail. */
export function ArenaLayout({
  roundLabel,
  showHeader,
  notice,
  children,
  aside,
}: ArenaLayoutProps) {
  // Too narrow for a side rail: the scoreboard follows the phase pane instead.
  const stacked = useMediaQuery(breakpoint.narrow)

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100dvh',
        background: color.cream,
        color: color.ink,
        fontFamily: font.body,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {showHeader && <ArenaHeader roundLabel={roundLabel} />}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: stacked ? 'column' : 'row',
          minHeight: 0,
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {notice && <ArenaNotice message={notice} />}
          {children}
        </div>
        {aside}
      </div>
    </div>
  )
}
