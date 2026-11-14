import type { ReactNode } from 'react'
import { color, fluid, font, sharedStyles } from '../../theme/index.ts'
import type { ConnectionStatus } from '../../network/index.ts'

interface ConnectionGateProps {
  status: ConnectionStatus
  /** A refused handshake, e.g. a protocol mismatch. Fatal; nothing retries. */
  error: string | null
  children: ReactNode
}

const MESSAGES: Record<ConnectionStatus, { eyebrow: string; line: string }> = {
  connecting: { eyebrow: 'CONNECTING', line: 'Finding the party server…' },
  reconnecting: { eyebrow: 'OFFLINE', line: 'Lost the party server. Retrying…' },
  connected: { eyebrow: '', line: '' },
}

/** Holds back the arena until there is a server to talk to. */
export function ConnectionGate({ status, error, children }: ConnectionGateProps) {
  if (status === 'connected' && !error) return <>{children}</>

  const message = MESSAGES[status]

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: color.cream,
        color: color.ink,
        fontFamily: font.body,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 14,
          padding: fluid(24, 52),
          textAlign: 'center',
        }}
      >
        <div style={sharedStyles.eyebrow}>{error ? 'ERROR' : message.eyebrow}</div>
        <div style={{ ...sharedStyles.displayHeading, fontSize: fluid(34, 56), maxWidth: '18ch' }}>
          {error ?? message.line}
        </div>
      </div>
    </div>
  )
}
