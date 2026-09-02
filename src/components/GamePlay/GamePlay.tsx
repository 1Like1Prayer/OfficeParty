import { color, font, sharedStyles } from '../../theme/index.ts'
import { Countdown } from './Countdown.tsx'
import { MinigameCanvas } from './MinigameCanvas.tsx'
import { PlayerLights } from './PlayerLights.tsx'

interface GamePlayProps {
  gameName: string
  statusLine: string
  /** Milliseconds until the clock runs, or null once it is running. */
  countdownMs: number | null
  /** One light per participant, lit while their clock is running. */
  lights: { id: string; initial: string; color: string; active: boolean }[]
}

/** The live round. Phones do the playing; this screen narrates it. */
export function GamePlay({ gameName, statusLine, countdownMs, lights }: GamePlayProps) {
  return (
    <section
      style={{ ...sharedStyles.phasePane, alignItems: 'center', gap: 24, textAlign: 'center' }}
    >
      <h1
        style={{
          ...sharedStyles.displayHeading,
          margin: 0,
          fontSize: 56,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: color.red,
        }}
      >
        {gameName}
      </h1>
      <MinigameCanvas>
        {countdownMs === null ? (
          <PlayerLights lights={lights} />
        ) : (
          <Countdown msLeft={countdownMs} />
        )}
      </MinigameCanvas>
      <div
        style={{
          fontFamily: font.body,
          fontWeight: 700,
          fontSize: 17,
          color: color.mutedStrong,
        }}
      >
        {statusLine}
      </div>
    </section>
  )
}
