/** What the scene needs to know about one player's lane, as of this render. */
export interface LaneView {
  playerId: string
  score: number
  /** Points behind the leader. */
  gap: number
  /** 0 = keeping pace, 1 = about to be crushed. */
  slip: number
  /** Crushed: the runner is lost to the black hole. */
  isFallen: boolean
  /** Won the race: they jump for joy and nothing can take them now. */
  isWinner?: boolean
  isYou: boolean
}
