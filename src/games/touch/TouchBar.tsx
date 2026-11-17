import type { ReactNode } from 'react'

/**
 * A phone's touch controls along the foot of the screen: the action button
 * under the left thumb, clear of the home bar and notch, and the stick's zone
 * across the bottom-right of the screen. The stick rests in that zone's
 * corner, and comes to wherever the right thumb lands in it (see Joystick).
 */
export function TouchBar({ enabled, action, stick }: { enabled: boolean; action: ReactNode; stick: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: enabled ? 1 : 0.45,
        transition: 'opacity .2s',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 'max(18px, env(safe-area-inset-left))',
          bottom: 'max(18px, env(safe-area-inset-bottom))',
        }}
      >
        {action}
      </div>
      {/* The right half of the screen, the bottom part of it: where a right thumb rests. */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '50%',
          height: 'max(45%, 200px)',
        }}
      >
        {stick}
      </div>
    </div>
  )
}
