import { color, font, pegboard } from '../../theme/index.ts'
import { BigButton } from '../ui/index.ts'

interface TitleScreenProps {
  minPlayers: number
  maxPlayers: number
  onHost: () => void
  onJoin: () => void
  /** Set while the create request is in flight. */
  busy: boolean
}

/** The attract screen: host a new room, or display an existing one. */
export function TitleScreen({
  minPlayers,
  maxPlayers,
  onHost,
  onJoin,
  busy,
}: TitleScreenProps) {
  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 52px',
        gap: 40,
        position: 'relative',
        overflow: 'hidden',
        animation: 'pa-swoop .45s ease-out',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: 0.55, ...pegboard() }} />
      <div
        style={{
          position: 'relative',
          textAlign: 'center',
          animation: 'pa-bob 4s ease-in-out infinite',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 168,
            lineHeight: 0.86,
            letterSpacing: '-0.04em',
            color: color.red,
            WebkitTextStroke: `6px ${color.ink}`,
            paintOrder: 'stroke fill',
            textShadow: `12px 12px 0 ${color.yellow}`,
          }}
        >
          Office
          <br />
          Party
        </h1>
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
        <BigButton onClick={onHost} disabled={busy}>
          {busy ? 'Opening…' : 'Host'}
        </BigButton>
        <BigButton variant="yellow" onClick={onJoin} disabled={busy}>
          Join
        </BigButton>
      </div>
      <div
        style={{
          position: 'relative',
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: '0.24em',
          color: color.mutedStrong,
        }}
      >
        {minPlayers}–{maxPlayers} PLAYERS
      </div>
    </section>
  )
}
