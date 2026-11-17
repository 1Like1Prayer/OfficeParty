import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CUBE_COUNTER, MAX_POSSIBLE_BOX_COUNT } from '../../shared/games/cubeCounter/constants.ts'
import { countBlocks } from '../../shared/games/cubeCounter/sceneValidation.ts'
import type { Answer, CubeCounterRound } from '../../shared/games/cubeCounter/types.ts'
import { PushButton } from '../../components/ui/index.ts'
import { border, color, fluid, font } from '../../theme/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import { TvIntro } from '../ui/TvIntro.tsx'
import { cubeCounterShow, type PuzzleStage } from './tvShow.ts'

const isRound = (data: unknown): data is CubeCounterRound =>
  typeof data === 'object' &&
  data !== null &&
  Array.isArray((data as CubeCounterRound).puzzles)

const MAX_DIGITS = String(MAX_POSSIBLE_BOX_COUNT).length

/** How long each stage of a puzzle lasts, once it has begun; answering ends sooner on an answer. */
const stageLengthMs = (stage: PuzzleStage, flashMs: number): number | null => {
  switch (stage) {
    case 'flash':
      return flashMs
    case 'answer':
      return CUBE_COUNTER.ANSWER_LIMIT_MS
    case 'reveal':
      return CUBE_COUNTER.REVEAL_MS
    case 'next':
      return CUBE_COUNTER.NEXT_PUZZLE_MS
    case 'done':
      return null
  }
}

/**
 * Count the blocks, eight puzzles running, all on the TV in front of the
 * player (see tvShow.ts). Each puzzle flashes up, hides while they answer,
 * comes back with whether they were right, then "next puzzle" counts them into
 * the next. Only the answer box sits over the picture, while they answer.
 *
 * Every player goes at their own pace: the browser runs the whole round on its
 * own clock, so the flash length and the time to answer are measured here,
 * not by the server.
 */
export function CubeCounter({
  phase,
  data,
  timingStartsAtLocalMs,
  players,
  selfPlayerId,
  progress,
  finalRanking,
  submitted,
  onSubmit,
  onProgress,
}: GameSurfaceProps) {
  const puzzles = useMemo(() => (isRound(data) ? data.puzzles : []), [data])
  const playing = phase === 'playing'

  const [index, setIndex] = useState(0)
  const [stage, setStage] = useState<PuzzleStage>('flash')
  // The first puzzle flashes up the moment the clock starts.
  const [stageStartedAtMs, setStageStartedAtMs] = useState(timingStartsAtLocalMs)
  const [typed, setTyped] = useState('')
  const [lastAnswer, setLastAnswer] = useState<number | null>(null)
  const [rightSoFar, setRightSoFar] = useState(0)

  const answers = useRef<Answer[]>([])
  const suspect = useRef(false)

  const puzzle = puzzles[index]
  const isDone = stage === 'done' || submitted

  const moveTo = useCallback((next: PuzzleStage) => {
    setStage(next)
    setStageStartedAtMs(performance.now())
  }, [])

  useEffect(() => {
    if (!playing) return
    const onVisibility = () => {
      if (document.hidden) suspect.current = true
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility) }
  }, [playing])

  const record = useCallback(
    (count: number | null) => {
      if (stage !== 'answer' || puzzle === undefined) return
      const answerMs = Math.min(
        CUBE_COUNTER.ANSWER_LIMIT_MS,
        Math.max(0, Math.round(performance.now() - stageStartedAtMs)),
      )
      answers.current.push({ count, answerMs })
      setLastAnswer(count)
      if (count === countBlocks(puzzle.boxes)) setRightSoFar((right) => right + 1)
      setTyped('')
      moveTo('reveal')
      onProgress({ puzzlesDone: answers.current.length })
      if (answers.current.length === puzzles.length) {
        onSubmit({ answers: answers.current, timingSuspect: suspect.current })
      }
    },
    [stage, puzzle, stageStartedAtMs, puzzles.length, moveTo, onProgress, onSubmit],
  )

  // Each stage runs its length, then gives way to the next: out of time counts as no answer.
  useEffect(() => {
    if (!playing || puzzle === undefined) return
    const lengthMs = stageLengthMs(stage, puzzle.flashMs)
    if (lengthMs === null) return
    const timer = window.setTimeout(() => {
      if (stage === 'flash') moveTo('answer')
      else if (stage === 'answer') record(null)
      else if (stage === 'reveal') moveTo(index + 1 >= puzzles.length ? 'done' : 'next')
      else {
        setIndex((current) => current + 1)
        moveTo('flash')
      }
    }, stageStartedAtMs + lengthMs - performance.now())
    return () => { window.clearTimeout(timer) }
  }, [playing, stage, stageStartedAtMs, puzzle, index, puzzles.length, moveTo, record])

  const submitTyped = () => {
    if (typed !== '') record(Number(typed))
  }

  // The TV picture, built once per round; it is told how the round stands as that changes.
  const tvShow = useMemo(() => (isRound(data) ? cubeCounterShow(data) : null), [data])
  const names = useMemo(
    () => Object.fromEntries(players.map(({ playerId, name }) => [playerId, name])),
    [players],
  )
  useEffect(() => {
    tvShow?.setLive({
      stage: submitted && stage !== 'reveal' ? 'done' : stage,
      index,
      stageStartedAtMs,
      typed,
      lastAnswer,
      rightSoFar,
      answeredById: Object.fromEntries(
        Object.entries(progress).map(([playerId, report]) => [playerId, report.puzzlesDone ?? 0]),
      ),
      ranking: finalRanking,
      names,
    })
  }, [tvShow, stage, submitted, index, stageStartedAtMs, typed, lastAnswer, rightSoFar, progress, finalRanking, names])

  if (tvShow === null) return null
  const isAnswering = playing && !isDone && stage === 'answer'
  return (
    <TvIntro players={players} selfPlayerId={selfPlayerId} timingStartsAtLocalMs={timingStartsAtLocalMs} show={tvShow}>
      {(isAnswering || (playing && isDone && finalRanking === null)) && (
        // Along the bottom, under the screen. Only the controls take clicks; the picture never does.
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 'max(22px, env(safe-area-inset-bottom))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: fluid(6, 8),
            padding: '0 16px',
            textAlign: 'center',
            animation: 'pa-fade-up .3s ease-out both',
          }}
        >
          {isAnswering ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: fluid(8, 12), maxWidth: '100%', pointerEvents: 'auto' }}>
                <input
                  // Mounted only while answering, so it takes focus the moment the
                  // scene hides and the player can type straight away.
                  autoFocus
                  value={typed}
                  inputMode="numeric"
                  enterKeyHint="done"
                  autoComplete="off"
                  aria-label="How many blocks?"
                  placeholder="?"
                  onChange={(event) => {
                    setTyped(event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS))
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submitTyped()
                  }}
                  style={{
                    width: fluid(120, 170),
                    minWidth: 0,
                    flexShrink: 1,
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    fontFamily: font.display,
                    fontWeight: 700,
                    fontSize: fluid(26, 36),
                    padding: '0.1em 0.3em',
                    color: color.ink,
                    background: color.white,
                    border: border.medium,
                    borderRadius: 16,
                    outline: 'none',
                  }}
                />
                {/* A phone's number pad has no Enter key, so the answer needs a
                    button of its own to be sent from a touch screen. */}
                <div style={{ flexShrink: 0 }}>
                  <PushButton size="sm" variant="success" disabled={typed === ''} onClick={submitTyped}>
                    OK
                  </PushButton>
                </div>
              </div>
              <div style={{ fontFamily: font.mono, fontSize: fluid(11, 13), color: color.cream, opacity: 0.75 }}>
                TYPE IT, THEN HIT ENTER OR OK
              </div>
            </>
          ) : (
            <div
              style={{
                padding: '10px 20px',
                borderRadius: 999,
                background: 'rgba(14, 9, 36, 0.72)',
                border: `3px solid ${color.ink}`,
                color: color.cream,
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: fluid(16, 20),
                animation: 'pa-pulse 2s ease-in-out infinite',
              }}
            >
              Waiting for everyone else…
            </div>
          )}
        </div>
      )}
    </TvIntro>
  )
}
