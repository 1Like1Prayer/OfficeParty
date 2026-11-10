import { TYPE_RACER } from '../../../shared/games/typeRacer/constants.ts'
import type {
  DieRoll,
  Paragraph,
  TypingEvent,
} from '../../../shared/games/typeRacer/types.ts'

/**
 * This player's race, as the browser tracks it while they type.
 *
 * It follows the same rules the server replays (see `shared/games/typeRacer/
 * replay.ts`), so what is shown here and what the server decides agree. The
 * server still has the last word: this only drives what the player sees.
 */
/**
 * After a wrong key the line starts over, and for this long every key is ignored:
 * a fast typist's next few characters would otherwise land straight on the
 * fresh line. Ignored keys are not mistakes and are not reported.
 */
export const MISTAKE_DEBOUNCE_MS = 500

export interface RaceState {
  /**
   * typing: keys count · rolling: three strikes, waiting on the dice ·
   * finished: every paragraph done · survived: everyone else is out, so this
   * player wins where they stand · out: crushed by a skull or by the clock.
   */
  status: 'typing' | 'rolling' | 'finished' | 'survived' | 'out'
  paragraphIndex: number
  lineIndex: number
  /** Correct characters on the line being typed. */
  typedInLine: number
  strikes: number
  /** Dice survived so far; also the index of the next roll. */
  rollsCast: number
  /**
   * When typing on the current paragraph opens, in ms from the race start. For
   * every paragraph after the first that is after the pause that follows the
   * last one; keys before it are ignored, as the server ignores them.
   */
  paragraphStartedAtMs: number
  /** When the last paragraph was finished, so the pause after it can be drawn. */
  pausedFromMs: number
  events: TypingEvent[]
  /** The server's answer for the roll in progress, once it has come back. */
  pendingRoll: DieRoll | null
  cause: 'skull' | 'time' | null
  endedAtMs: number | null
  /** Counts wrong keys, so the screen can flash on each one. */
  mistakeCount: number
  /** Keys before this race time (ms) are ignored: the pause after a mistake. */
  ignoreKeysUntilMs: number
  /** Counts finished lines, so the scene can ring the carriage bell. */
  linesDoneCount: number
  /** Counts correct keys, so the scene can work the typewriter. */
  correctKeys: number
}

export type RaceAction =
  | { type: 'key'; key: string; atMs: number }
  /** The server told us how the dice landed. */
  | { type: 'rollAnswered'; roll: DieRoll }
  /** The dice have finished tumbling; their result takes effect. */
  | { type: 'rollSettled'; atMs: number }
  /** The paragraph's time ran out. */
  | { type: 'timeout'; atMs: number }
  /** Every other player is out: this player has won without finishing. */
  | { type: 'lastSurvivor'; atMs: number }

export const initialRaceState: RaceState = {
  status: 'typing',
  paragraphIndex: 0,
  lineIndex: 0,
  typedInLine: 0,
  strikes: 0,
  rollsCast: 0,
  paragraphStartedAtMs: 0,
  pausedFromMs: 0,
  events: [],
  pendingRoll: null,
  cause: null,
  endedAtMs: null,
  mistakeCount: 0,
  ignoreKeysUntilMs: 0,
  linesDoneCount: 0,
  correctKeys: 0,
}

export const currentLine = (
  paragraphs: readonly Paragraph[],
  state: Pick<RaceState, 'paragraphIndex' | 'lineIndex'>,
): string => paragraphs[state.paragraphIndex]?.[state.lineIndex] ?? ''

function typeKey(
  state: RaceState,
  paragraphs: readonly Paragraph[],
  key: string,
  atMs: number,
): RaceState {
  if (state.status !== 'typing') return state
  // Typing is closed during the pause between paragraphs, and while recovering
  // from the last mistake: either way this key never happened.
  if (atMs < state.paragraphStartedAtMs || atMs < state.ignoreKeysUntilMs) return state

  const line = currentLine(paragraphs, state)
  if (key === line[state.typedInLine]) {
    const typedInLine = state.typedInLine + 1
    const correctKeys = state.correctKeys + 1
    if (typedInLine < line.length) return { ...state, typedInLine, correctKeys }

    // The line is done: on to the next, and the next paragraph after the last.
    const next: RaceState = {
      ...state,
      correctKeys,
      typedInLine: 0,
      lineIndex: state.lineIndex + 1,
      events: [...state.events, { kind: 'line', atMs }],
      linesDoneCount: state.linesDoneCount + 1,
    }
    if (next.lineIndex < (paragraphs[state.paragraphIndex]?.length ?? 0)) return next

    const paragraphIndex = state.paragraphIndex + 1
    const finished = paragraphIndex === paragraphs.length
    return {
      ...next,
      paragraphIndex,
      lineIndex: 0,
      // A finished paragraph wipes the strikes; the dice keep their skulls. After it
      // comes a pause, and the next paragraph's clock starts only when that ends.
      strikes: 0,
      pausedFromMs: atMs,
      paragraphStartedAtMs: finished ? atMs : atMs + TYPE_RACER.PARAGRAPH_PAUSE_MS,
      status: finished ? 'finished' : 'typing',
      endedAtMs: finished ? atMs : null,
    }
  }

  // A wrong key: the line starts over, and the paragraph gains a strike.
  const strikes = state.strikes + 1
  return {
    ...state,
    typedInLine: 0,
    strikes,
    events: [...state.events, { kind: 'mistake', atMs }],
    mistakeCount: state.mistakeCount + 1,
    ignoreKeysUntilMs: atMs + MISTAKE_DEBOUNCE_MS,
    status: strikes >= TYPE_RACER.STRIKES_TO_ROLL ? 'rolling' : 'typing',
  }
}

/** The reducer for one race. It needs the text, so it is built from it. */
export const createRaceReducer =
  (paragraphs: readonly Paragraph[]) =>
  (state: RaceState, action: RaceAction): RaceState => {
    switch (action.type) {
      case 'key':
        return typeKey(state, paragraphs, action.key, action.atMs)

      case 'rollAnswered':
        return state.status === 'rolling' && state.pendingRoll === null
          ? { ...state, pendingRoll: action.roll }
          : state

      case 'rollSettled': {
        if (state.status !== 'rolling' || state.pendingRoll === null) return state
        if (state.pendingRoll.isSkull) {
          return { ...state, status: 'out', cause: 'skull', endedAtMs: action.atMs, pendingRoll: null }
        }
        // A heart: back to two strikes, and the next die has another skull.
        return {
          ...state,
          status: 'typing',
          strikes: TYPE_RACER.STRIKES_AFTER_SURVIVING,
          rollsCast: state.rollsCast + 1,
          pendingRoll: null,
        }
      }

      case 'timeout':
        if (state.status !== 'typing' && state.status !== 'rolling') return state
        return { ...state, status: 'out', cause: 'time', endedAtMs: action.atMs, pendingRoll: null }

      case 'lastSurvivor':
        // Whatever they were in the middle of no longer matters, even the dice.
        if (state.status !== 'typing' && state.status !== 'rolling') return state
        return { ...state, status: 'survived', endedAtMs: action.atMs, pendingRoll: null }
    }
  }
