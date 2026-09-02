import type { ReactNode } from 'react'
import { color, font } from '../../theme/index.ts'

interface MinigameCanvasProps {
  /** The live playfield. Falls back to the placeholder frame when absent. */
  children?: ReactNode
}

/** Shared playfield frame every minigame renders into. */
export function MinigameCanvas({ children }: MinigameCanvasProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 860,
        height: 280,
        borderRadius: 20,
        border: `4px dashed ${color.dashed}`,
        backgroundImage: `repeating-linear-gradient(45deg,${color.white} 0 10px,#FFF8E8 10px 20px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      {children ?? (
        <>
          <div style={{ fontFamily: font.mono, fontSize: 14, color: color.mutedStrong, letterSpacing: '0.1em' }}>
            MINIGAME CANVAS
          </div>
          <div style={{ fontSize: 18, color: color.muted, maxWidth: '44ch' }}>
            Live playfield renders here. Phones drive it; this screen is the shared truth.
          </div>
        </>
      )}
    </div>
  )
}
