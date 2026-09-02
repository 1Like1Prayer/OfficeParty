export interface Player {
  id: string
  name: string
  /** Hex swatch assigned by the server; used for the avatar tile. */
  color: string
  points: number
  /** Points won in the most recent finished game. */
  lastGain: number
  /** 1-based finishing position in the most recent game, 0 before any game. */
  place: number
  /** Flavour line for the results list, e.g. "out at the wire". */
  note: string
}
