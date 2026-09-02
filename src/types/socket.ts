import type { RoomState } from './room.ts'

/** Intents the arena screen sends. The server owns all state transitions. */
export interface ClientToServerEvents {
  'room:join': (code: string) => void
  'run:start': () => void
  'game:begin': () => void
  'game:finish': () => void
  'game:next': () => void
  'run:reset': () => void
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void
  'room:error': (message: string) => void
}
