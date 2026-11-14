import { createContext } from 'react'
import type { Client } from '@colyseus/sdk'
import type { PartyConnection } from './partyConnection.ts'

export interface NetworkContextValue {
  client: Client
  /** The server answered its health check. Only meaningful outside a room. */
  serverReachable: boolean
  /** The room this tab is in, or null on the title, host and join screens. */
  connection: PartyConnection | null
  setConnection: (connection: PartyConnection | null) => void
  /** A refusal nothing can recover from, such as an outdated page. */
  fatalError: string | null
  setFatalError: (message: string | null) => void
}

/** Null until the provider mounts; `useNetwork` turns that into a hard error. */
export const NetworkContext = createContext<NetworkContextValue | null>(null)
