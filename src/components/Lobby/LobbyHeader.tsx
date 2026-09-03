import { useHover } from '../../hooks/index.ts'
import { color, sharedStyles } from '../../theme/index.ts'
import { RoomCodeButton } from './RoomCodeButton.tsx'

interface LobbyHeaderProps {
  roomCode: string
  onBack: () => void
}

/** Back out of the room, the title, and the code everyone else needs. */
export function LobbyHeader({ roomCode, onBack }: LobbyHeaderProps) {
  const [hovered, handlers] = useHover()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 30, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={onBack}
        {...handlers}
        style={{
          ...sharedStyles.raised(hovered ? 3 : 5),
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: color.white,
          color: color.ink,
          borderRadius: 999,
          padding: '12px 22px',
          fontSize: 20,
          transform: hovered ? 'translateY(2px)' : 'none',
          transition: 'transform .1s ease, box-shadow .1s ease',
        }}
      >
        ← Back
      </button>
      <h1
        style={{
          ...sharedStyles.displayHeading,
          margin: 0,
          fontSize: 54,
          lineHeight: 1,
        }}
      >
        Waiting room
      </h1>
      <RoomCodeButton roomCode={roomCode} />
    </div>
  )
}
