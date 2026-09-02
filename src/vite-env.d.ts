/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the socket.io backend, e.g. http://localhost:3000/game */
  readonly VITE_SOCKET_URL?: string
  /** Room this arena screen displays. */
  readonly VITE_ROOM_CODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
