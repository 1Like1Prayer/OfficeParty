import { useEffect, useReducer, useRef } from 'react'
import { useTabWasHidden, useThrottledReport } from '../../../hooks/index.ts'
import { MAX_RACE_MS, TYPE_RACER } from '../../../shared/games/typeRacer/constants.ts'
import { skullsForRoll } from '../../../shared/games/typeRacer/dice.ts'
import { charactersTyped } from '../../../shared/games/typeRacer/progress.ts'
import type { DieRoll, Paragraph } from '../../../shared/games/typeRacer/types.ts'
import { parseDieRoll } from './dieReply.ts'
import { typedCharacter } from './keys.ts'
import { createRaceReducer, initialRaceState, type RaceState } from './raceState.ts'

/**
 * How long the player is locked out after a third strike, counted from the
 * strike itself: the whole of the dice animation, and the cost of the mistake.
 */
export const ROLL_TOTAL_MS = 4000
/** If the server is slow to answer, the throw and the reading of it still get this long. */
const MIN_ROLL_AFTER_REPLY_MS = 2900
/** If the server cannot be reached for the dice, ask again after this. */
const ROLL_RETRY_MS = 900
/** Just past a paragraph's limit, so the server's replay also sees it as out of time. */
const TIMEOUT_MARGIN_MS = 50
/**
 * A reply that never comes (the connection dropped while it was in flight, and
 * socket.io then never answers) must not leave the die shaking for good.
 */
const ROLL_REPLY_TIMEOUT_MS = 2500

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('no reply')) }, ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error: unknown) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error('refused')) },
    )
  })

/** What this player reports to the rest of the room, as whole numbers. */
export interface TypingProgress {
  chars: number
  paragraph: number
  strikes: number
  /** Skull sides on the die they would roll next. */
  skulls: number
  /** 0 = typing, 1 = finished, 2 = out. */
  status: 0 | 1 | 2
}

interface UseTypingRaceOptions {
  paragraphs: readonly Paragraph[]
  timingStartsAtLocalMs: number
  /** The race clock is running. */
  isRacing: boolean
  /** Every other player is out, so this one has won where they stand. */
  isLastSurvivor: boolean
  /** Ask the server how the dice landed. */
  requestRoll: (rollIndex: number) => Promise<unknown>
  onSubmit: (result: unknown) => void
  onProgress: (progress: unknown) => void
}

export interface TypingRace {
  state: RaceState
  /** Correct characters in the whole race: what the shared bar shows. */
  chars: number
  progress: TypingProgress
}

const STATUS_CODE = { typing: 0, rolling: 0, finished: 1, survived: 1, out: 2 } as const

/**
 * Runs this player's race: counts their key presses, casts the dice when
 * they earn it, watches the paragraph clock, reports progress to the room,
 * and hands the server the whole story once they finish or are out.
 *
 * Rules live in `raceState.ts`; this adds time, the keyboard and the network.
 */
export function useTypingRace({
  paragraphs,
  timingStartsAtLocalMs,
  isRacing,
  isLastSurvivor,
  requestRoll,
  onSubmit,
  onProgress,
}: UseTypingRaceOptions): TypingRace {
  const [state, dispatch] = useReducer(createRaceReducer(paragraphs), initialRaceState)
  const tabWasHidden = useTabWasHidden(isRacing)
  const hasSubmitted = useRef(false)
  /** When the current roll began, so the lock ends four seconds after the strike. */
  const rollStartedAtMs = useRef(0)
  const rollStartedFor = useRef(-1)
  const elapsedMs = () => Math.max(0, Math.round(performance.now() - timingStartsAtLocalMs))

  // The keyboard.
  const isTyping = isRacing && state.status === 'typing'
  useEffect(() => {
    if (!isTyping) return
    const onKeyDown = (event: KeyboardEvent) => {
      const key = typedCharacter(event)
      if (key === null) return
      // Space would scroll the page, and quote keys open quick-find in some browsers.
      event.preventDefault()
      if (!event.repeat) dispatch({ type: 'key', key, atMs: elapsedMs() })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
    // elapsedMs only reads the race start, which is in the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTyping, timingStartsAtLocalMs])

  // Three strikes: ask the server how the dice land, and keep asking if it cannot answer.
  const isAskingForRoll = state.status === 'rolling' && state.pendingRoll === null
  useEffect(() => {
    if (!isAskingForRoll) return
    if (rollStartedFor.current !== state.rollsCast) {
      rollStartedFor.current = state.rollsCast
      rollStartedAtMs.current = performance.now()
    }
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const ask = () => {
      withTimeout(requestRoll(state.rollsCast), ROLL_REPLY_TIMEOUT_MS)
        .then((reply) => {
          const roll: DieRoll | null = parseDieRoll(reply)
          if (cancelled) return
          if (roll === null) retryTimer = setTimeout(ask, ROLL_RETRY_MS)
          else dispatch({ type: 'rollAnswered', roll })
        })
        .catch(() => {
          if (!cancelled) retryTimer = setTimeout(ask, ROLL_RETRY_MS)
        })
    }
    ask()

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
    }
  }, [isAskingForRoll, state.rollsCast, requestRoll])

  // The roll lasts four seconds from the strike, answer or not: only then does
  // its result take effect and the player may type again.
  const hasRollToSettle = state.pendingRoll !== null
  useEffect(() => {
    if (!hasRollToSettle) return
    const sinceStrikeMs = performance.now() - rollStartedAtMs.current
    const waitMs = Math.max(ROLL_TOTAL_MS - sinceStrikeMs, MIN_ROLL_AFTER_REPLY_MS)
    const timer = setTimeout(() => { dispatch({ type: 'rollSettled', atMs: elapsedMs() }) }, waitMs)
    return () => { clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRollToSettle, timingStartsAtLocalMs])

  // Each paragraph has its own time limit.
  const isOnTheClock = isRacing && (state.status === 'typing' || state.status === 'rolling')
  useEffect(() => {
    if (!isOnTheClock) return
    const deadlineMs = state.paragraphStartedAtMs + TYPE_RACER.PARAGRAPH_TIME_LIMIT_MS
    const timer = setTimeout(
      () => {
        dispatch({
          type: 'timeout',
          atMs: Math.min(MAX_RACE_MS, deadlineMs + TIMEOUT_MARGIN_MS),
        })
      },
      Math.max(0, timingStartsAtLocalMs + deadlineMs - performance.now()),
    )
    return () => { clearTimeout(timer) }
  }, [isOnTheClock, state.paragraphStartedAtMs, timingStartsAtLocalMs])

  // Everyone else is out: stop where we are and report. The server then ends
  // our run at the moment the last of them fell, so nothing typed after that counts.
  const canStillWin = state.status === 'typing' || state.status === 'rolling'
  useEffect(() => {
    if (isRacing && isLastSurvivor && canStillWin) dispatch({ type: 'lastSurvivor', atMs: elapsedMs() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRacing, isLastSurvivor, canStillWin, timingStartsAtLocalMs])

  // Report once, as soon as the race is over for this player. The server
  // replays the events itself, so nothing here claims an outcome.
  const isOver = state.status === 'finished' || state.status === 'survived' || state.status === 'out'
  useEffect(() => {
    if (!isOver || hasSubmitted.current || state.endedAtMs === null) return
    hasSubmitted.current = true
    onSubmit({ events: state.events, endedAtMs: state.endedAtMs, timingSuspect: tabWasHidden })
  }, [isOver, state.endedAtMs, state.events, tabWasHidden, onSubmit])

  const chars = charactersTyped(paragraphs, {
    paragraphIndex: state.paragraphIndex,
    lineIndex: state.lineIndex,
    typedInLine: state.typedInLine,
  })
  const progress: TypingProgress = {
    chars,
    paragraph: state.paragraphIndex,
    strikes: state.strikes,
    skulls: skullsForRoll(state.rollsCast),
    status: STATUS_CODE[state.status],
  }
  useThrottledReport(progress, isRacing, onProgress)

  return { state, chars, progress }
}
