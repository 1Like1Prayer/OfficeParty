import type { ConnectionStatus } from './types.ts'
import { useNetwork, usePartySnapshot } from './useNetwork.ts'

export interface ConnectionState {
  status: ConnectionStatus
  /**
   * Why the server refused this page, e.g. a protocol mismatch. Fatal: the
   * page has to be reloaded.
   */
  handshakeError: string | null
}

/**
 * In a room, the room's own connection decides (the SDK reconnects a dropped
 * one by itself). Outside a room there is no connection yet, so the server's
 * health check stands in for it.
 */
export function useConnectionStatus(): ConnectionState {
  const { serverReachable, fatalError } = useNetwork()
  const snapshot = usePartySnapshot()

  let status: ConnectionStatus
  if (snapshot !== null) status = snapshot.isConnected ? 'connected' : 'reconnecting'
  else status = serverReachable ? 'connected' : 'connecting'

  return { status, handshakeError: fatalError }
}
