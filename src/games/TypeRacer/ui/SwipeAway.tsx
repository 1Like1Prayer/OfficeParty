import type { ReactNode } from 'react'

const SWIPE_MS = 560
const EASING = 'cubic-bezier(.76,0,.24,1)'

interface SwipeAwayProps {
  /** Slide the content off to the side and give back the room it took. */
  isAway: boolean
  children: ReactNode
}

/**
 * Swipes its content off to the left and then closes the gap it leaves, so
 * what is behind it is revealed and anything laid out around it moves up.
 */
export function SwipeAway({ isAway, children }: SwipeAwayProps) {
  return (
    <div
      aria-hidden={isAway}
      style={{
        display: 'grid',
        // The row closes once the content has gone, so the layout follows it.
        gridTemplateRows: isAway ? '0fr' : '1fr',
        marginTop: isAway ? -10 : 0,
        transition: `grid-template-rows ${SWIPE_MS * 0.7}ms ${EASING} ${isAway ? SWIPE_MS * 0.55 : 0}ms, margin-top ${SWIPE_MS * 0.7}ms ${EASING} ${isAway ? SWIPE_MS * 0.55 : 0}ms`,
        pointerEvents: isAway ? 'none' : 'auto',
      }}
    >
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        <div
          style={{
            transform: isAway ? 'translateX(-125%)' : 'none',
            transition: `transform ${SWIPE_MS}ms ${EASING}`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
