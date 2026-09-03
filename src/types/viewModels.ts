/** Rows the selectors hand to presentational components. */

export interface ScoreboardRowView {
  id: string
  rank: number
  name: string
  initial: string
  color: string
  points: number
  /** e.g. "READY", "WAITING", "DISCONNECTED", "WATCHING". */
  status: string
  background: string
  pointsColor: string
  dimmed: boolean
  /** The reader's own row, so it can be picked out at a glance. */
  isYou: boolean
}

export interface ResultRowView {
  id: string
  /** Already formatted as "1.", "2." … */
  place: string
  name: string
  initial: string
  color: string
  /** Whatever the game reported, e.g. "stopped at 9.98s". */
  note: string
  /** "+1" when the round awarded a point, "—" otherwise. */
  gain: string
  isYou: boolean
}

export interface PlaylistRowView {
  id: string
  /** e.g. "3. Blade Arena". */
  name: string
  /** Uppercased game kind, e.g. "SELF-TIMED". */
  kind: string
  color: string
  dotColor: string
}
