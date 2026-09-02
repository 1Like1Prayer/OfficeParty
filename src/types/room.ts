import type { Game } from './game.ts'
import type { Player } from './player.ts'

export type RoomPhase = 'lobby' | 'reveal' | 'playing' | 'results' | 'final'

export interface RoomState {
  code: string
  phase: RoomPhase
  /** Index into `playlist` of the game being revealed, played or scored. */
  currentIndex: number
  playlist: Game[]
  players: Player[]
}
