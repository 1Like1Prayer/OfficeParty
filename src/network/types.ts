import type { Room } from '@colyseus/sdk'

/** A joined party room. Its state is read through `readPartyState`. */
export type PartyRoom = Room

/**
 * `connecting`: looking for the server, or rejoining after a reload.
 * `connected`: the server is reachable and, in a room, the seat is live.
 * `reconnecting`: the room connection dropped; the SDK is retrying while the
 *   server holds the seat.
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting'

/** This tab's seat in the room it is playing, kept across reloads. */
export interface ArenaSession {
  roomCode: string
  /** Hands back the same seat (and score) after a reload. */
  reconnectionToken: string
  name: string
  avatar: string
}
