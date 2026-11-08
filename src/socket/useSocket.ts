import { use } from 'react'
import { SocketContext } from './socketContext.ts'
import type { ArenaSocket } from './types.ts'

export function useSocket(): ArenaSocket {
  const socket = use(SocketContext)
  if (!socket) throw new Error('useSocket must be used inside a <SocketProvider>')
  return socket
}
