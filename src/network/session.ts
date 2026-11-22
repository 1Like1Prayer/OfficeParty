import { GAME_SESSION_KEY, SESSION_KEY } from './config.ts'
import type { ArenaSession } from './types.ts'

/**
 * This tab's seat, so a reload rejoins as the same player rather than taking
 * a second one. It lives in `sessionStorage`, not `localStorage`, because one
 * player is one tab: two tabs on the same machine are two people sitting at
 * two desks, and they must not share an identity.
 */
export function readSession(): ArenaSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as ArenaSession).roomCode === 'string' &&
      typeof (parsed as ArenaSession).reconnectionToken === 'string'
    ) {
      return parsed as ArenaSession
    }
  } catch {
    // Private browsing, cleared storage, or a value we no longer understand.
  }
  return null
}

export function writeSession(session: ArenaSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Storage is a convenience here; a lost session just means a new seat.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // As above.
  }
}

/** This tab's seat in the standalone game it moved into from the party room. */
export interface GameSession {
  /** The party room it was opened from: the seat only counts in that party. */
  partyCode: string
  roomCode: string
  reconnectionToken: string
}

export function readGameSession(): GameSession | null {
  try {
    const raw = sessionStorage.getItem(GAME_SESSION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as GameSession).partyCode === 'string' &&
      typeof (parsed as GameSession).roomCode === 'string' &&
      typeof (parsed as GameSession).reconnectionToken === 'string'
    ) {
      return parsed as GameSession
    }
  } catch {
    // As for the party seat.
  }
  return null
}

export function writeGameSession(session: GameSession): void {
  try {
    sessionStorage.setItem(GAME_SESSION_KEY, JSON.stringify(session))
  } catch {
    // A lost seat just means joining the game again from the lobby.
  }
}

export function clearGameSession(): void {
  try {
    sessionStorage.removeItem(GAME_SESSION_KEY)
  } catch {
    // As above.
  }
}
