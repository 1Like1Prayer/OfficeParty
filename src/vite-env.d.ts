/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin including the namespace, e.g. http://localhost:3000/game */
  readonly VITE_SOCKET_URL?: string
  /** Room to join. Empty (the default) creates a new room on connect. */
  readonly VITE_ROOM_CODE?: string
  /** Name the arena screen takes in the player list. */
  readonly VITE_DISPLAY_NAME?: string
  /** Join address printed under the room code. */
  readonly VITE_JOIN_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
