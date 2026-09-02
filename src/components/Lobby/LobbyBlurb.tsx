import { color } from '../../theme/index.ts'
import { Pill } from '../ui/index.ts'

interface LobbyBlurbProps {
  text: string
  facts: string[]
}

export function LobbyBlurb({ text, facts }: LobbyBlurbProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 14,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 19, lineHeight: 1.5, color: color.muted, maxWidth: '34ch' }}>
        {text}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {facts.map((fact) => (
          <Pill key={fact} variant="outline">
            {fact}
          </Pill>
        ))}
      </div>
    </div>
  )
}
