import { color, font } from '../../../theme/index.ts'

interface SpectatorHintProps {
  /** Who the camera is watching. */
  name: string
  /** More than one is still typing, so there is someone to switch to. */
  canSwitch: boolean
  isTouch: boolean
}

/** Along the bottom once the player is out: whom they are watching, and how to watch someone else. */
export function SpectatorHint({ name, canSwitch, isTouch }: SpectatorHintProps) {
  return (
    <div
      style={{
        position: 'absolute',
        // Centred by margins, not a transform, so the fade-up animation's own transform cannot undo it.
        left: 0,
        right: 0,
        margin: '0 auto',
        width: 'fit-content',
        bottom: 'max(18px, env(safe-area-inset-bottom))',
        maxWidth: 'calc(100% - 32px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '8px 18px',
        borderRadius: 999,
        background: 'rgba(14, 9, 36, 0.72)',
        border: `3px solid ${color.ink}`,
        backdropFilter: 'blur(6px)',
        color: color.cream,
        fontFamily: font.display,
        fontWeight: 700,
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 5,
        animation: 'pa-fade-up .4s ease-out both',
      }}
    >
      <div key={name} style={{ fontSize: 17, animation: 'pa-pop .4s cubic-bezier(.34,1.56,.64,1)' }}>
        👀 Watching <span style={{ color: color.yellow }}>{name}</span>
      </div>
      {canSwitch && (
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          {isTouch ? 'Tap the screen' : 'Click or press Space'} to watch someone else
        </div>
      )}
    </div>
  )
}
