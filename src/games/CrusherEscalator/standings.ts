import { CRUSHER_ESCALATOR } from '../../shared/games/crusherEscalator/constants.ts'
import type { ArrowSequence, Input } from '../../shared/games/crusherEscalator/types.ts'
import type { RankedEntry } from '../../shared/games/selfTimed.ts'
import type { RoundPlayerView } from '../../types/index.ts'

export type ScoresByPlayer = Record<string, number>

const { STARTING_SCORE } = CRUSHER_ESCALATOR

/** Did the press at `pressIndex` match the arrow that was showing? */
export const isCorrectPress = (
  input: Input,
  arrows: ArrowSequence,
  pressIndex: number,
): boolean => input.direction === arrows(pressIndex)

export const countCorrectPresses = (inputs: readonly Input[], arrows: ArrowSequence): number =>
  inputs.filter((input, pressIndex) => isCorrectPress(input, arrows, pressIndex)).length

/**
 * Everyone's score as this screen knows it: our own is exact, the others
 * arrive as progress reports and can trail a little.
 */
export function collectScores({
  players,
  selfPlayerId,
  selfScore,
  progress,
}: {
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  selfScore: number
  progress: Record<string, Record<string, number>>
}): ScoresByPlayer {
  return Object.fromEntries(
    players.map(({ playerId }) => [
      playerId,
      playerId === selfPlayerId
        ? selfScore
        : (progress[playerId]?.score ?? STARTING_SCORE),
    ]),
  )
}

/** How far each player is behind the leader (whoever has the highest score). */
export function gapsBehindLeader(scores: ScoresByPlayer): Record<string, number> {
  const lead = Math.max(STARTING_SCORE, ...Object.values(scores))
  return Object.fromEntries(Object.entries(scores).map(([playerId, score]) => [playerId, lead - score]))
}

/**
 * The same rule the server applies when it replays the race. `eliminationGap`
 * is the gap allowed right now, which narrows as the race goes on.
 */
export const isCrushed = (gap: number, eliminationGap: number): boolean => gap >= eliminationGap

/** 0 = keeping pace with the leader, 1 = about to be crushed. */
export const slipFraction = (gap: number, eliminationGap: number): number =>
  Math.min(1, Math.max(0, gap / eliminationGap))

/** Who the server's replay says was crushed. Its word beats what this screen guessed. */
export const crushedPlayerIds = (ranking: readonly RankedEntry[]): ReadonlySet<string> =>
  new Set(ranking.filter(({ detail }) => detail.survived === false).map(({ playerId }) => playerId))

/** Who the server's replay says was still running when the race ended. */
export const survivingPlayerIds = (ranking: readonly RankedEntry[]): string[] =>
  ranking.filter(({ detail }) => detail.survived === true).map(({ playerId }) => playerId)
