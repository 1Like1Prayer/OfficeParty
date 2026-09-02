import { color, sharedStyles } from '../../theme/index.ts'
import { PushButton } from '../ui/index.ts'
import { JoinQrCard } from './JoinQrCard.tsx'
import { LobbyBlurb } from './LobbyBlurb.tsx'
import { RoomCodeCard } from './RoomCodeCard.tsx'
import { RoundsPicker } from './RoundsPicker.tsx'

interface LobbyProps {
  roomCode: string
  joinUrl: string
  roundsPerGame: number
  roundsOptions: number[]
  minPlayers: number
  maxPlayers: number
  canStart: boolean
  /** Why start is unavailable, or the go-ahead when it is. */
  startNote: string
  onStart: () => void
  onSetRounds: (rounds: number) => void
  qrImageUrl?: string
}

/** Waiting room: join details, run settings and the start button. */
export function Lobby({
  roomCode,
  joinUrl,
  roundsPerGame,
  roundsOptions,
  minPlayers,
  maxPlayers,
  canStart,
  startNote,
  onStart,
  onSetRounds,
  qrImageUrl,
}: LobbyProps) {
  return (
    <section style={{ ...sharedStyles.phasePane, gap: 30 }}>
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
        <RoomCodeCard code={roomCode} joinUrl={joinUrl} />
        <JoinQrCard imageUrl={qrImageUrl} />
        <LobbyBlurb
          text={`Games are drawn at random and played ${roundsPerGame} times each. A point per round. One name ends up on top of that board.`}
          facts={[`${minPlayers}–${maxPlayers} PLAYERS`, 'PHONES ARE THE CONTROLLERS']}
        />
      </div>

      <RoundsPicker value={roundsPerGame} options={roundsOptions} onChange={onSetRounds} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <PushButton size="lg" onClick={onStart} disabled={!canStart}>
          Start the run
        </PushButton>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: color.mutedStrong,
            animation: canStart ? 'pa-pulse 2.4s ease-in-out infinite' : undefined,
          }}
        >
          {startNote}
        </div>
      </div>
    </section>
  )
}
