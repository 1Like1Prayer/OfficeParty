import type { ReactNode } from 'react'
import { color, font } from '../../theme/index.ts'
import { RoundCue } from './RoundCue.tsx'

interface GamePlayProps {
  gameName: string
  statusLine: string
  /** Beats left in the start cue, or null while the game is still building up. */
  cueBeats: number | null
  /**
   * The game fills the whole pane and the title and countdown float over it,
   * rather than the game sitting in the space left beneath them.
   */
  isFullBleed?: boolean
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
  cueBeats,
  isFullBleed = false,
  children,
}: GamePlayProps) {
  if (isFullBleed) {
    return (
      <section
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          animation: 'pa-enter 1.5s cubic-bezier(.22,.61,.36,1) both',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>{children}</div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '22px 24px',
            gap: 16,
            // Only decoration: the keyboard is the controller, and nothing
            // here should ever swallow a click meant for the game.
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <div
            style={{
              alignSelf: 'flex-start',
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 30,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: color.cream,
              textShadow: `0 2px 0 ${color.ink}`,
            }}
          >
            {gameName}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {cueBeats !== null && (
              <div
                style={{
                  padding: '4px 36px',
                  borderRadius: 28,
                  background: color.cream,
                  border: `4px solid ${color.ink}`,
                }}
              >
                <RoundCue beats={cueBeats} />
              </div>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Anchored to the top rather than centred: the parts below appear and
        // disappear as the round moves, and centring would shove the title and
        // the target around every time one of them did.
        justifyContent: 'flex-start',
        gap: 22,
        padding: '64px 52px 40px',
        textAlign: 'center',
        backgroundImage: `repeating-linear-gradient(45deg,${color.white} 0 10px,#FFF8E8 10px 20px)`,
        animation: 'pa-enter 1.5s cubic-bezier(.22,.61,.36,1) both',
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
          // Staggered behind the pane so the round assembles rather than
          // arriving all at once.
          animation: 'pa-enter 1.1s ease-out .45s both',
        }}
      >
        {gameName}
      </div>

      {/* Takes whatever height the title and cue leave, so a game that wants the
          whole screen can fill it; the others stay centred at the top. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'pa-enter 1.1s ease-out 1s both',
        }}
      >
        {children}
      </div>

      {/* Reserved whether or not it is showing, so the cue arriving moves
          nothing that is already on screen. */}
      <div
        style={{
          minHeight: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {cueBeats !== null && <RoundCue beats={cueBeats} />}
      </div>

      {statusLine !== '' && (
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
      )}
    </section>
  )
}
