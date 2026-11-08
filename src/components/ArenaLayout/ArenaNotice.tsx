import { border, color } from '../../theme/index.ts'

interface ArenaNoticeProps {
  message: string
}

/** The server refused something. Say so; the room carries on regardless. */
export function ArenaNotice({ message }: ArenaNoticeProps) {
  return (
    <div
      style={{
        margin: '16px 52px 0',
        padding: '10px 18px',
        borderRadius: 12,
        border: border.medium,
        background: color.yellow,
        fontWeight: 700,
        fontSize: 15,
      }}
    >
      {message}
    </div>
  )
}
