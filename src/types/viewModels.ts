/** Rows the selectors hand to presentational components. */

export interface ScoreboardRowView {
  id: string
  rank: number
  name: string
  initial: string
  color: string
  points: number
  /** e.g. "+7 LAST GAME", "READY", "NO POINTS". */
  status: string
  background: string
  pointsColor: string
}

export interface ResultRowView {
  id: string
  /** Already formatted as "1.", "2." … */
  place: string
  name: string
  initial: string
  color: string
  note: string
  /** "+10" when points were won, "—" otherwise. */
  gain: string
}

export interface PlaylistRowView {
  id: string
  /** e.g. "3. Blade Arena". */
  name: string
  kind: string
  color: string
  dotColor: string
}
