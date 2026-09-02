import type { ReactNode } from 'react'
import { color, sharedStyles } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'
import { MinigameCanvas } from './MinigameCanvas.tsx'

interface GamePlayProps {
  gameName: string
  onFinishGame: () => void
  /** Playfield for the running minigame. */
  children?: ReactNode
}

/** The live round: title, playfield and the manual finish escape hatch. */
export function GamePlay({ gameName, onFinishGame, children }: GamePlayProps) {
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
      <MinigameCanvas>{children}</MinigameCanvas>
      <PushButton variant="success" size="sm" onClick={onFinishGame}>
        Simulate result
      </PushButton>
    </section>
  )
}
