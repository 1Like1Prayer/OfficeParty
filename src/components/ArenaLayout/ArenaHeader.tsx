import { border, color, font } from '../../theme/index.ts'
import { Pill } from '../ui/index.ts'

interface ArenaHeaderProps {
  roundLabel: string
}

export function ArenaHeader({ roundLabel }: ArenaHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 44px',
        borderBottom: border.heavy,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 32,
          letterSpacing: '-0.02em',
          color: color.red,
        }}
      >
        Office Party
      </div>
      {roundLabel && <Pill variant="round">{roundLabel}</Pill>}
    </header>
  )
}
