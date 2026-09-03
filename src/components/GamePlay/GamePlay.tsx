import type { ReactNode } from 'react'
import { color, font } from '../../theme/index.ts'
import { Countdown } from './Countdown.tsx'
import { PlayerLights } from './PlayerLights.tsx'

interface GamePlayProps {
  gameName: string
  statusLine: string
  /** Milliseconds until the clock runs, or null once it is running. */
  countdownMs: number | null
  /** One light per opponent, lit while their clock is running. */
  lights: { id: string; initial: string; color: string; active: boolean }[]
  /** The game itself, from the moment the round is being set up. */
  children?: ReactNode
}

/**
 * The live round takes the whole screen — no header, no scoreboard — because
 * this is the part that is actually being played.
 */
export function GamePlay({
  gameName,
  statusLine,
  countdownMs,
  lights,
  children,
}: GamePlayProps) {
  return (
    <section
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
        padding: '40px 52px',
        textAlign: 'center',
        backgroundImage: `repeating-linear-gradient(45deg,${color.white} 0 10px,#FFF8E8 10px 20px)`,
        animation: 'pa-swoop .45s ease-out',
      }}
    >
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 40,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: color.red,
        }}
      >
        {gameName}
      </div>

      {children}

      {countdownMs !== null && <Countdown msLeft={countdownMs} />}

      {lights.length > 0 && <PlayerLights lights={lights} />}

      <div
        style={{
          fontFamily: font.mono,
          fontSize: 13,
          color: color.mutedStrong,
          letterSpacing: '0.1em',
        }}
      >
        {statusLine.toUpperCase()}
      </div>
    </section>
  )
}
