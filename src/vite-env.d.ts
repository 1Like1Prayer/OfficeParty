/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The Colyseus server's HTTP(S) origin, e.g. http://localhost:2567 */
  readonly VITE_SERVER_URL?: string
  /** Room to join on load, skipping the title card. */
  readonly VITE_ROOM_CODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
