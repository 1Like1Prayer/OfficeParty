/** The Colyseus server's HTTP(S) origin. The SDK derives the WebSocket URL from it. */
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:2567'

/** Room to join on load, skipping the title card. Normally empty. */
export const ROOM_CODE = import.meta.env.VITE_ROOM_CODE ?? ''

/**
 * This tab's seat in the room, kept across reloads. Per-tab, so two tabs on
 * one machine are two players.
 */
export const SESSION_KEY = 'party-arena/session'

/** How often to re-check a server that could not be reached. */
export const HEALTH_RETRY_MS = 2_000
