import { useEffect, useState } from 'react'
import { useSocket } from './useSocket.ts'
import type { ConnectionStatus } from './types.ts'

export interface ConnectionState {
  status: ConnectionStatus
  /**
   * Why the handshake was refused. A protocol mismatch is fatal — socket.io
   * will not retry into a server that has already said no.
   */
  handshakeError: string | null
}

/** Tracks the transport, including the namespace's protocol-version refusal. */
export function useConnectionStatus(): ConnectionState {
  const socket = useSocket()
  const [status, setStatus] = useState<ConnectionStatus>(
    socket.connected ? 'connected' : 'connecting',
  )
  const [handshakeError, setHandshakeError] = useState<string | null>(null)

  useEffect(() => {
    const onConnect = () => {
      setStatus('connected')
      setHandshakeError(null)
    }
    const onDisconnect = () => { setStatus('disconnected') }
    const onConnectError = (error: Error) => {
      setStatus('disconnected')
      setHandshakeError(error.message)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
    }
  }, [socket])

  return { status, handshakeError }
}
