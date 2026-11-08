/** Backend origin *including the namespace* — the game lives on `/game`. */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '/game'

/** Room to join on load, skipping the title card. Normally empty. */
export const ROOM_CODE = import.meta.env.VITE_ROOM_CODE ?? ''

/**
 * This tab's identity in the room, kept across reloads. Per-tab, so two tabs
 * on one machine are two players.
 */
export const SESSION_KEY = 'party-arena/session'
