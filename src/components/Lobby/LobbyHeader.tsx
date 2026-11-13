import { useHover } from '../../hooks/index.ts'
import { color, fluid, sharedStyles } from '../../theme/index.ts'
import { RoomCodeButton } from './RoomCodeButton.tsx'

interface LobbyHeaderProps {
  roomCode: string
  onBack: () => void
}

/** Back out of the room, the title, and the code everyone else needs. */
export function LobbyHeader({ roomCode, onBack }: LobbyHeaderProps) {
  const [hovered, handlers] = useHover()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${fluid(14, 20)} ${fluid(14, 30)}`, flexWrap: 'wrap' }}>
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
          padding: `${fluid(8, 12)} ${fluid(14, 22)}`,
          fontSize: fluid(16, 20),
          whiteSpace: 'nowrap',
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
          fontSize: fluid(32, 54),
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        Waiting room
      </h1>
      <RoomCodeButton roomCode={roomCode} />
    </div>
  )
}
