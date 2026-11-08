import { color, sharedStyles } from '../../theme/index.ts'
import { Panel } from '../ui/index.ts'

interface RulesCardProps {
  rules: string
}

export function RulesCard({ rules }: RulesCardProps) {
  return (
    <Panel accent={color.pink} style={{ padding: '26px 30px', maxWidth: '62ch' }}>
      <div style={{ ...sharedStyles.microLabel, fontSize: 12, letterSpacing: '0.2em', marginBottom: 10 }}>
        HOW YOU WIN
      </div>
      <div style={{ fontSize: 24, lineHeight: 1.45, textWrap: 'pretty' }}>{rules}</div>
    </Panel>
  )
}
