import { createContext } from 'react'
import type { ArenaSocket } from './types.ts'

/** Null until the provider mounts; `useSocket` turns that into a hard error. */
export const SocketContext = createContext<ArenaSocket | null>(null)
