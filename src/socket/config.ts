/** Backend origin. Empty string lets socket.io use the page origin (dev proxy). */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? ''

/** Room this screen renders. The arena display is pinned to one room. */
export const ROOM_CODE = import.meta.env.VITE_ROOM_CODE ?? 'GRND'
