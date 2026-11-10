import { useState, type CSSProperties, type ReactNode } from 'react'
import { border, color } from '../../theme/index.ts'

interface ScreenTransitionProps {
  /** Identifies the screen. The transition plays whenever it changes. */
  screenKey: string
  children: ReactNode
}

/** Which part of the swipe is running. */
type Stage = 'covering' | 'revealing'

/** Top, middle and bottom panels. The middle one travels the opposite way. */
const PANELS = [
  { background: color.pink, entersFrom: 'left' },
  { background: color.yellow, entersFrom: 'right' },
  { background: color.mint, entersFrom: 'left' },
] as const

const COVER_MS = 340
const REVEAL_MS = 440
/** Each panel starts this long after the one before it, so the swipe ripples across. */
const STAGGER_MS = 70
const EASING = 'cubic-bezier(.76,0,.24,1)'

/** The same diagonal stripes as the play screen's background, so the panels belong to the party. */
const STRIPES =
  'repeating-linear-gradient(45deg, rgba(255,255,255,0.28) 0 14px, rgba(255,255,255,0) 14px 28px)'

const panelStyle = (index: number, stage: Stage): CSSProperties => {
  const { background, entersFrom } = PANELS[index]!
  // Each panel leaves the way it was heading: through the screen, not back out of it.
  const animation =
    stage === 'covering'
      ? `pa-swipe-in-from-${entersFrom} ${COVER_MS}ms ${EASING} ${index * STAGGER_MS}ms both`
      : `pa-swipe-out-to-${entersFrom === 'left' ? 'right' : 'left'} ${REVEAL_MS}ms ${EASING} ${index * STAGGER_MS}ms both`

  return {
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${(index * 100) / PANELS.length}%`,
    // A sliver taller than a third, so no seam shows between neighbours.
    height: `${100 / PANELS.length + 0.3}%`,
    background,
    backgroundImage: STRIPES,
    borderTop: index > 0 ? border.heavy : undefined,
    borderBottom: index < PANELS.length - 1 ? border.heavy : undefined,
    animation,
  }
}

/**
 * Swipes between whole screens. The screen is covered by three horizontal
 * bands that sweep across it, the next screen is put in place behind them,
 * and the bands sweep on and away to show it.
 *
 * The old screen stays exactly as it was until it is covered — nothing flashes
 * ahead of the panels — and clicks are blocked while it is. A new screen that
 * arrives while one is already in progress simply waits for it to finish.
 */
export function ScreenTransition({ screenKey, children }: ScreenTransitionProps) {
  // What is on screen: the last settled screen, held while it is being covered.
  const [shown, setShown] = useState({ screenKey, children })
  const [stage, setStage] = useState<Stage | null>(null)

  if (stage === null) {
    // Following along with the live screen until it changes.
    if (screenKey !== shown.screenKey) setStage('covering')
    else if (shown.children !== children) setShown({ screenKey, children })
  }

  const showLive = stage === null || stage === 'revealing'
  const lastPanel = PANELS.length - 1

  return (
    <>
      {showLive ? children : shown.children}

      {stage !== null && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            overflow: 'hidden',
            // The panels only need to stop clicks while they cover the screen.
            pointerEvents: stage === 'covering' ? 'auto' : 'none',
          }}
        >
          {PANELS.map((_, index) => (
            <div
              key={index}
              style={panelStyle(index, stage)}
              onAnimationEnd={
                index === lastPanel
                  ? () => {
                      if (stage === 'covering') {
                        // Fully covered: put the new screen in place behind the panels.
                        setShown({ screenKey, children })
                        setStage('revealing')
                      } else {
                        setStage(null)
                      }
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </>
  )
}
