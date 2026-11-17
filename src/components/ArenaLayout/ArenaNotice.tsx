import { border, color, fluid } from '../../theme/index.ts'
import { useEffect } from 'react'
import { sfx } from '../../audio/sfx/index.ts'

interface ArenaNoticeProps {
  message: string
}

/** The server refused something. Say so; the room carries on regardless. */
export function ArenaNotice({ message }: ArenaNoticeProps) {
  // A buzz as each new refusal appears.
  useEffect(() => { sfx.ui.error() }, [message])
  return (
    <div
      style={{
        margin: `${fluid(12, 16)} ${fluid(16, 52)} 0`,
        padding: `${fluid(8, 10)} ${fluid(12, 18)}`,
        borderRadius: 12,
        border: border.medium,
        background: color.yellow,
        fontWeight: 700,
        fontSize: fluid(14, 15),
        overflowWrap: 'break-word',
      }}
    >
      {message}
    </div>
  )
}
