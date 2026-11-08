import { SESSION_KEY } from './config.ts'
import type { ArenaSession } from './types.ts'

/**
 * This tab's slot, so a reload rejoins as the same player rather than taking a
 * second one. It lives in `sessionStorage`, not `localStorage`, because one
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
      typeof (parsed as ArenaSession).playerId === 'string'
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
    // Storage is a convenience here; a lost session just means a new slot.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // As above.
  }
}
