import { useCopyText, useHover } from '../../hooks/index.ts'
import { border, color, font, lift } from '../../theme/index.ts'

interface RoomCodeButtonProps {
  roomCode: string
}

/** The code everyone else types in. Click it to put it on the clipboard. */
export function RoomCodeButton({ roomCode }: RoomCodeButtonProps) {
  const [hovered, handlers] = useHover()
  const { copied, failed, copy } = useCopyText()

  const label = copied ? 'COPIED' : failed ? 'COPY IT BY HAND' : 'CODE · CLICK TO COPY'

  return (
    <button
      type="button"
      onClick={() => { copy(roomCode) }}
      title="Copy the room code"
      {...handlers}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: copied ? color.green : color.yellow,
        color: color.ink,
        border: border.heavy,
        borderRadius: 18,
        padding: '12px 24px',
        cursor: 'pointer',
        boxShadow: lift(hovered ? 3 : 5),
        transform: hovered ? 'translateY(2px)' : 'none',
        transition: 'transform .1s ease, box-shadow .1s ease, background .15s ease',
      }}
    >
      <span
        style={{
          fontWeight: 900,
          fontSize: 11,
          letterSpacing: '0.2em',
          opacity: 0.65,
          maxWidth: 88,
          textAlign: 'left',
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: '0.08em',
        }}
      >
        {roomCode}
      </span>
    </button>
  )
}
