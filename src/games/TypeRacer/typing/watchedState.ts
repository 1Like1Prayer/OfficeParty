import type { Paragraph } from '../../../shared/games/typeRacer/types.ts'
import type { StationView } from '../scene/TypeRacerScene.ts'
import { initialRaceState, type RaceState } from './raceState.ts'

/**
 * Someone else's race, rebuilt from what they report (how many characters
 * they have typed, their strikes, whether they are out) so the typing sheet
 * can show it to a player who is watching them. Read-only: it is drawn, never
 * typed into. `mistakeCount` is how many times their count has dropped, which
 * is a wrong key sending them back to the start of the line.
 */
export function watchedRaceState(paragraphs: readonly Paragraph[], view: StationView, mistakeCount: number): RaceState {
  let remaining = Math.max(0, view.chars)
  let paragraphIndex = 0
  let lineIndex = 0
  let typedInLine = 0
  // Walk to the character they are on: a finished line moves them to the start of the next.
  for (; paragraphIndex < paragraphs.length; paragraphIndex++) {
    const lines = paragraphs[paragraphIndex]!
    let found = false
    for (lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const length = lines[lineIndex]!.length
      if (remaining < length) {
        typedInLine = remaining
        found = true
        break
      }
      remaining -= length
    }
    if (found) break
  }
  const isFinished = view.status === 'finished' || paragraphIndex >= paragraphs.length

  return {
    ...initialRaceState,
    status:
      view.status === 'out' ? 'out' : isFinished ? 'finished' : view.strikes >= 3 ? 'rolling' : 'typing',
    paragraphIndex: Math.min(paragraphIndex, paragraphs.length - 1),
    lineIndex: isFinished ? Number.MAX_SAFE_INTEGER : lineIndex,
    typedInLine,
    strikes: Math.min(3, view.strikes),
    cause: view.status === 'out' ? (view.strikes >= 3 ? 'skull' : 'time') : null,
    mistakeCount,
  }
}
