import { use, useSyncExternalStore } from 'react'
import { NetworkContext, type NetworkContextValue } from './networkContext.ts'
import type { PartySnapshot } from './partyConnection.ts'

export function useNetwork(): NetworkContextValue {
  const network = use(NetworkContext)
  if (!network) throw new Error('useNetwork must be used inside a <NetworkProvider>')
  return network
}

const NO_SUBSCRIPTION = () => () => undefined
const NO_SNAPSHOT = () => null

/** The current room's snapshot, re-rendering only when it changes. Null outside a room. */
export function usePartySnapshot(): PartySnapshot | null {
  const { connection } = useNetwork()
  return useSyncExternalStore(
    connection?.subscribe ?? NO_SUBSCRIPTION,
    connection?.getSnapshot ?? NO_SNAPSHOT,
  )
}
