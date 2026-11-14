import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Client } from '@colyseus/sdk'
import { HEALTH_RETRY_MS, SERVER_URL } from './config.ts'
import { NetworkContext, type NetworkContextValue } from './networkContext.ts'
import type { PartyConnection } from './partyConnection.ts'

interface NetworkProviderProps {
  url?: string
  children: ReactNode
}

/**
 * Owns the Colyseus client and the room this tab is in.
 *
 * Unlike a socket.io connection, a Colyseus client holds no connection until
 * it joins a room, so "is the server there?" is answered by a health check
 * until then. Closing the tab simply drops the room's socket: the server
 * holds the seat for a while, which is what lets a reload rejoin.
 */
export function NetworkProvider({ url = SERVER_URL, children }: NetworkProviderProps) {
  const client = useMemo(() => new Client(url), [url])
  const serverReachable = useServerReachable(url)
  const [connection, setConnection] = useState<PartyConnection | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  const value = useMemo<NetworkContextValue>(
    () => ({ client, serverReachable, connection, setConnection, fatalError, setFatalError }),
    [client, serverReachable, connection, fatalError],
  )

  return <NetworkContext value={value}>{children}</NetworkContext>
}

/** Polls `/health` until the server answers once. */
function useServerReachable(url: string): boolean {
  const [reachable, setReachable] = useState(false)

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const check = async () => {
      try {
        const response = await fetch(new URL('/health', url))
        if (response.ok) {
          if (!cancelled) setReachable(true)
          return
        }
      } catch {
        // Not up yet.
      }
      if (!cancelled) retryTimer = setTimeout(check, HEALTH_RETRY_MS)
    }
    void check()

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
    }
  }, [url])

  return reachable
}
