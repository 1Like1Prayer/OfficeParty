import { border, color, font } from '../../theme/index.ts'

interface JoinQrCardProps {
  /** Rendered QR image. Falls back to the design's placeholder when absent. */
  imageUrl?: string
}

export function JoinQrCard({ imageUrl }: JoinQrCardProps) {
  return (
    <div
      style={{
        width: 178,
        height: 178,
        flexShrink: 0,
        borderRadius: 20,
        background: color.white,
        border: border.heavy,
        padding: 12,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Scan to join the room"
          style={{ width: '100%', height: '100%', borderRadius: 6 }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 6,
            backgroundImage: `repeating-linear-gradient(45deg,${color.ink} 0 6px,${color.white} 6px 12px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: color.white,
              color: color.ink,
              fontFamily: font.mono,
              fontSize: 10,
              fontWeight: 700,
              padding: '6px 7px',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            JOIN QR
            <br />
            goes here
          </div>
        </div>
      )}
    </div>
  )
}
