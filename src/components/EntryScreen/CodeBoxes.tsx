import { border, color, font } from '../../theme/index.ts'

interface CodeBoxesProps {
  entry: string
  length: number
  invalid: boolean
}

/** One box per character of the room code. */
export function CodeBoxes({ entry, length, invalid }: CodeBoxesProps) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {Array.from({ length }, (_, index) => (
        <div
          key={index}
          style={{
            flex: 1,
            aspectRatio: '1',
            border: border.heavy,
            borderRadius: 14,
            background: invalid
              ? color.pinkSoft
              : entry[index]
                ? color.yellowSoft
                : color.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 40,
          }}
        >
          {entry[index] ?? ''}
        </div>
      ))}
    </div>
  )
}
