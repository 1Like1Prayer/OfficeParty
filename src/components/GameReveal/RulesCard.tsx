import { color, fluid, sharedStyles } from '../../theme/index.ts'
import { Panel } from '../ui/index.ts'

interface RulesCardProps {
  rules: string
}

export function RulesCard({ rules }: RulesCardProps) {
  return (
    <Panel accent={color.pink} style={{ padding: `${fluid(16, 26)} ${fluid(16, 30)}`, maxWidth: '62ch' }}>
      <div style={{ ...sharedStyles.microLabel, fontSize: fluid(11, 12), letterSpacing: '0.2em', marginBottom: fluid(6, 10) }}>
        HOW YOU WIN
      </div>
      <div style={{ fontSize: fluid(17, 24), lineHeight: 1.45, textWrap: 'pretty', overflowWrap: 'break-word' }}>{rules}</div>
    </Panel>
  )
}
