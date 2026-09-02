import { border, color, font } from '../../theme/index.ts'

interface RoomCodeCardProps {
  code: string
  /** Where players go to join, shown under the code. */
  joinUrl?: string
}

export function RoomCodeCard({ code, joinUrl = 'party.arena / join' }: RoomCodeCardProps) {
  return (
    <div
      style={{
        background: color.yellow,
        color: color.ink,
        border: border.heavy,
        borderRadius: 20,
        padding: '22px 30px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        justifyContent: 'center',
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: '0.2em', opacity: 0.6 }}>
        ROOM CODE
      </div>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 74,
          lineHeight: 1,
          letterSpacing: '0.06em',
        }}
      >
        {code}
      </div>
      <div style={{ fontWeight: 700, fontSize: 16, opacity: 0.7 }}>{joinUrl}</div>
    </div>
  )
}
