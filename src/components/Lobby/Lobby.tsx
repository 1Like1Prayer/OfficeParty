import { color, sharedStyles } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'
import { JoinQrCard } from './JoinQrCard.tsx'
import { LobbyBlurb } from './LobbyBlurb.tsx'
import { RoomCodeCard } from './RoomCodeCard.tsx'

interface LobbyProps {
  roomCode: string
  gameCount: number
  onStartRun: () => void
  qrImageUrl?: string
}

/** Waiting room: join details, run summary and the start button. */
export function Lobby({ roomCode, gameCount, onStartRun, qrImageUrl }: LobbyProps) {
  return (
    <section style={{ ...sharedStyles.phasePane, gap: 34 }}>
      <div>
        <div style={{ ...sharedStyles.eyebrow, marginBottom: 12 }}>WAITING ROOM</div>
        <h1
          style={{
            ...sharedStyles.displayHeading,
            margin: 0,
            fontSize: 70,
            maxWidth: '15ch',
            textWrap: 'balance',
          }}
        >
          Grab your phone. It&rsquo;s your controller.
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'stretch' }}>
        <RoomCodeCard code={roomCode} />
        <JoinQrCard imageUrl={qrImageUrl} />
        <LobbyBlurb
          text={`${gameCount} games, drawn at random. Placement points every round. One name ends up on top of that board.`}
          facts={['5–8 PLAYERS', '~12 MINUTES', 'NO HOST NEEDED']}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <PushButton size="lg" onClick={onStartRun}>
          Start the run
        </PushButton>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: color.mutedStrong,
            animation: 'pa-pulse 2.4s ease-in-out infinite',
          }}
        >
          Anyone can press it. That&rsquo;s the whole rule.
        </div>
      </div>
    </section>
  )
}
