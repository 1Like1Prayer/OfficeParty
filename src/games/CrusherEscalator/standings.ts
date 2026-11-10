import { CRUSHER_ESCALATOR } from '../../shared/games/crusherEscalator/constants.ts'
import { directionAt } from '../../shared/games/crusherEscalator/stream.ts'
import type { ArrowStream, Input } from '../../shared/games/crusherEscalator/types.ts'
import type { RankedEntry } from '../../shared/games/selfTimed.ts'
import type { RoundPlayerView } from '../../types/index.ts'

export type ScoresByPlayer = Record<string, number>

const { STARTING_SCORE, ELIMINATION_GAP } = CRUSHER_ESCALATOR

/** Did the press at `pressIndex` match the arrow that was showing? */
export const isCorrectPress = (
  input: Input,
  stream: ArrowStream,
  pressIndex: number,
): boolean => input.direction === directionAt(stream, pressIndex)

export const countCorrectPresses = (inputs: readonly Input[], stream: ArrowStream): number =>
  inputs.filter((input, pressIndex) => isCorrectPress(input, stream, pressIndex)).length

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

/**
 * How far each player is behind the leader of their own group. In the heats
 * two groups race side by side and only ever compare themselves with each
 * other; in a final everyone is in one group.
 */
export function gapsBehindGroupLeader(
  scores: ScoresByPlayer,
  groups: readonly (readonly string[])[],
): Record<string, number> {
  const gaps: Record<string, number> = {}
  for (const group of groups) {
    const lead = Math.max(STARTING_SCORE, ...group.map((playerId) => scores[playerId] ?? STARTING_SCORE))
    for (const playerId of group) gaps[playerId] = lead - (scores[playerId] ?? STARTING_SCORE)
  }
  return gaps
}

/** The same rule the server applies when it replays the race. */
export const isCrushed = (gap: number): boolean => gap >= ELIMINATION_GAP

/** 0 = keeping pace with the leader, 1 = about to be crushed. */
export const slipFraction = (gap: number): number =>
  Math.min(1, Math.max(0, gap / ELIMINATION_GAP))

/** Who the server's replay says was crushed. Its word beats what this screen guessed. */
export const crushedPlayerIds = (ranking: readonly RankedEntry[]): ReadonlySet<string> =>
  new Set(ranking.filter(({ detail }) => detail.survived === false).map(({ playerId }) => playerId))

/** Who the server's replay says was still running when the race ended. */
export const survivingPlayerIds = (ranking: readonly RankedEntry[]): string[] =>
  ranking.filter(({ detail }) => detail.survived === true).map(({ playerId }) => playerId)
