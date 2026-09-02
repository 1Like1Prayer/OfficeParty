/** Backend origin *including the namespace* — the game lives on `/game`. */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '/game'

/**
 * Room this screen shows. Empty means "create a fresh room on connect", which
 * is the normal way to start a party: the arena owns the room it displays.
 */
export const ROOM_CODE = import.meta.env.VITE_ROOM_CODE ?? ''

/** Name the arena takes in the player list. */
export const DISPLAY_NAME = import.meta.env.VITE_DISPLAY_NAME ?? 'Big Screen'

/** Where players are told to go, printed under the room code. */
export const JOIN_URL = import.meta.env.VITE_JOIN_URL ?? 'party.arena / join'

/**
 * The arena's identity, kept across reloads so a refresh reclaims the same
 * player slot (and with it ownership) instead of taking a second one.
 */
export const SESSION_KEY = 'party-arena/session'
