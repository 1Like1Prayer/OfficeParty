import { SESSION_KEY } from './config.ts'
import type { ArenaSession } from './types.ts'

/**
 * The arena's slot, persisted so a reload reclaims the same player id. Without
 * it every refresh would take a new slot and hand ownership to a phone.
 */
export function readSession(): ArenaSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
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
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Storage is a convenience here; a lost session just means a new slot.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // As above.
  }
}
