import type { ReactNode } from 'react'

/**
 * The strip along the foot of a phone's screen that holds a game's touch
 * controls: the stick under the left thumb, the action under the right, clear
 * of the home bar and notch, and nothing in between to catch a stray touch.
 */
export function TouchBar({ enabled, left, right }: { enabled: boolean; left: ReactNode; right: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding:
          '0 max(18px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left))',
        pointerEvents: 'none',
        opacity: enabled ? 1 : 0.45,
        transition: 'opacity .2s',
      }}
    >
      {left}
      {right}
    </div>
  )
}
