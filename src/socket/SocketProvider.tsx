import { useEffect, useMemo, type ReactNode } from 'react'
import { io } from 'socket.io-client'
import { SOCKET_URL } from './config.ts'
import { SocketContext } from './socketContext.ts'
import type { ArenaSocket } from './types.ts'

interface SocketProviderProps {
  url?: string
  children: ReactNode
}

/** Owns the single socket.io connection for the whole app. */
export function SocketProvider({ url = SOCKET_URL, children }: SocketProviderProps) {
  const socket = useMemo<ArenaSocket>(
    () => io(url, { autoConnect: false, transports: ['websocket'] }),
    [url],
  )

  useEffect(() => {
    socket.connect()
    return () => {
      socket.disconnect()
    }
  }, [socket])

  return <SocketContext value={socket}>{children}</SocketContext>
}
