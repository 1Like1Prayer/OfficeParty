/** How a minigame decides its winner. Drives copy, scoring and result notes. */
export type GameKind = 'SURVIVE' | 'RACE' | 'PRECISION'

export interface Game {
  id: string
  name: string
  kind: GameKind
  /** Controller verb shown on the reveal screen, e.g. "Tilt + tap". */
  input: string
  /** Human-readable duration, e.g. "90s". */
  length: string
  rules: string
}
