import { border, color, fluid, font } from '../../theme/index.ts'
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
        flexWrap: 'wrap',
        gap: '8px 16px',
        padding: `${fluid(12, 20)} ${fluid(16, 44)}`,
        borderBottom: border.heavy,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: fluid(22, 32),
          whiteSpace: 'nowrap',
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
