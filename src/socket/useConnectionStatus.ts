import { useEffect, useState } from 'react'
import { useSocket } from './useSocket.ts'
import type { ConnectionStatus } from './types.ts'

export function useConnectionStatus(): ConnectionStatus {
  const socket = useSocket()
  const [status, setStatus] = useState<ConnectionStatus>(
    socket.connected ? 'connected' : 'connecting',
  )

  useEffect(() => {
    const onConnect = () => { setStatus('connected') }
    const onDisconnect = () => { setStatus('disconnected') }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [socket])

  return status
}
