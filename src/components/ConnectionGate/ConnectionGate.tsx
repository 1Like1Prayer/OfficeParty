import type { ReactNode } from 'react'
import { color, font, sharedStyles } from '../../theme/index.ts'
import type { ConnectionStatus } from '../../socket/index.ts'
import { StripeBar } from '../ui/index.ts'

interface ConnectionGateProps {
  status: ConnectionStatus
  /** True once the first room snapshot has arrived. */
  hasState: boolean
  error: string | null
  children: ReactNode
}

const MESSAGES: Record<ConnectionStatus, { eyebrow: string; line: string }> = {
  connecting: { eyebrow: 'CONNECTING', line: 'Finding the arena server…' },
  disconnected: { eyebrow: 'OFFLINE', line: 'Lost the arena server. Retrying…' },
  connected: { eyebrow: 'SYNCING', line: 'Waiting for the room state…' },
}

/** Holds back the arena until the server has told us what the room looks like. */
export function ConnectionGate({ status, hasState, error, children }: ConnectionGateProps) {
  if (status === 'connected' && hasState && !error) return <>{children}</>

  const message = MESSAGES[status]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: color.cream,
        color: color.ink,
        fontFamily: font.body,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <StripeBar />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 14,
          padding: 52,
          textAlign: 'center',
        }}
      >
        <div style={sharedStyles.eyebrow}>{error ? 'ERROR' : message.eyebrow}</div>
        <div style={{ ...sharedStyles.displayHeading, fontSize: 56, maxWidth: '18ch' }}>
          {error ?? message.line}
        </div>
      </div>
    </div>
  )
}
