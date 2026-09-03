/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin including the namespace, e.g. http://localhost:3000/game */
  readonly VITE_SOCKET_URL?: string
  /** Room to join on load, skipping the title card. */
  readonly VITE_ROOM_CODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
