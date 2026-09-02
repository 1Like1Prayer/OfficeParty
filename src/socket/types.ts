import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.ts'

export type ArenaSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
