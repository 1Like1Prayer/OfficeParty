import { useCallback, useEffect, useRef, useState } from 'react'
import { CUBE_COUNTER, MAX_POSSIBLE_BOX_COUNT } from '../../shared/games/cubeCounter/constants.ts'
import { countBlocks } from '../../shared/games/cubeCounter/sceneValidation.ts'
import type { Answer, CubeCounterRound } from '../../shared/games/cubeCounter/types.ts'
import { border, color, font, sharedStyles } from '../../theme/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import { useElapsed } from '../StopTheClock/useElapsed.ts'
import { IsoScene } from './IsoScene.tsx'
import { SCENE_ASPECT } from './projection.ts'

/**
 * Sizes follow the viewport height, because height is what the round runs out
 * of: the scene and the answer area share one screen.
 */
const fluid = (minPx: number, vh: number, maxPx: number): string =>
  `clamp(${minPx}px, ${vh}vh, ${maxPx}px)`

const isRound = (data: unknown): data is CubeCounterRound =>
  typeof data === 'object' &&
  data !== null &&
  Array.isArray((data as CubeCounterRound).puzzles)

/** flash: scene showing · answer: scene hidden, typing · pause: result of the last answer. */
type Stage = 'flash' | 'answer' | 'pause'

const MAX_DIGITS = String(MAX_POSSIBLE_BOX_COUNT).length

/**
 * Count the blocks. The browser runs the whole round on its own clock, so the
 * flash length and the time to answer are measured here, not by the server.
 */
export function CubeCounter({
  phase,
  data,
  submitted,
  onSubmit,
  onProgress,
}: GameSurfaceProps) {
  const puzzles = isRound(data) ? data.puzzles : []
  const playing = phase === 'playing'

  const [index, setIndex] = useState(0)
  const [stage, setStage] = useState<Stage>('flash')
  const [typed, setTyped] = useState('')
  const [hiddenAt, setHiddenAt] = useState(0)
  const [lastAnswer, setLastAnswer] = useState<number | null | undefined>(undefined)
  const [finished, setFinished] = useState(false)

  const answers = useRef<Answer[]>([])
  const suspect = useRef(false)

  const puzzle = puzzles[index]
  const done = finished || submitted

  useEffect(() => {
    if (!playing) return
    const onVisibility = () => {
      if (document.hidden) suspect.current = true
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility) }
  }, [playing])

  // Flash -> answer, on the scene's own length.
  useEffect(() => {
    if (!playing || done || stage !== 'flash' || !puzzle) return
    const timer = setTimeout(() => {
      setHiddenAt(performance.now())
      setStage('answer')
    }, puzzle.flashMs)
    return () => { clearTimeout(timer) }
  }, [playing, done, stage, puzzle])

  const record = useCallback(
    (count: number | null) => {
      if (stage !== 'answer') return
      const answerMs = Math.min(
        CUBE_COUNTER.ANSWER_LIMIT_MS,
        Math.max(0, Math.round(performance.now() - hiddenAt)),
      )
      answers.current.push({ count, answerMs })
      setLastAnswer(count)
      setTyped('')
      setStage('pause')
      onProgress({ puzzlesDone: answers.current.length })
      if (answers.current.length === puzzles.length) {
        setFinished(true)
        onSubmit({ answers: answers.current, timingSuspect: suspect.current })
      }
    },
    [stage, hiddenAt, puzzles.length, onProgress, onSubmit],
  )

  // Out of time counts as no answer.
  useEffect(() => {
    if (stage !== 'answer') return
    const timer = setTimeout(() => { record(null) }, CUBE_COUNTER.ANSWER_LIMIT_MS)
    return () => { clearTimeout(timer) }
  }, [stage, record])

  // Pause -> next puzzle.
  useEffect(() => {
    if (stage !== 'pause' || finished) return
    const timer = setTimeout(() => {
      setIndex((current) => current + 1)
      setLastAnswer(undefined)
      setStage('flash')
    }, CUBE_COUNTER.PAUSE_BETWEEN_PUZZLES_MS)
    return () => { clearTimeout(timer) }
  }, [stage, finished])

  const submitTyped = () => {
    if (typed !== '') record(Number(typed))
  }

  const msLeft = useElapsed(hiddenAt, playing && stage === 'answer')
  const timeLeft = Math.max(0, 1 - msLeft / CUBE_COUNTER.ANSWER_LIMIT_MS)

  const correct = puzzle ? countBlocks(puzzle.boxes) : 0
  const showScene = stage === 'flash' || stage === 'pause'

  let headline = 'COUNT THE BLOCKS'
  if (playing && !done) headline = `PUZZLE ${Math.min(index + 1, puzzles.length)} / ${puzzles.length}`
  if (done) headline = 'ALL DONE'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ ...sharedStyles.microLabel, letterSpacing: '0.22em', fontSize: 15, height: 20 }}>
        {headline}
      </div>

      <div
        style={{
          position: 'relative',
          // About 38% of the screen's height, never wider than the screen.
          width: `min(90vw, calc(38vh * ${SCENE_ASPECT}))`,
          aspectRatio: String(SCENE_ASPECT),
        }}
      >
        {/* The floor is part of the scene: it only exists while a scene is
            showing, so there is nothing on screen before the round starts or
            while the player is answering. */}
        {playing && !done && showScene && puzzle && <IsoScene boxes={puzzle.boxes} />}
        {playing && !done && stage === 'answer' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: fluid(64, 12, 120),
              color: color.mutedSoft,
            }}
          >
            ?
          </div>
        )}
      </div>

      <div style={{ minHeight: fluid(96, 14, 140), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {playing && done && (
          <div
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: fluid(20, 3.2, 30),
              color: color.mutedStrong,
              animation: 'pa-pulse 2s ease-in-out infinite',
            }}
          >
            Locked in. Waiting for everyone else…
          </div>
        )}

        {playing && !done && stage === 'flash' && (
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: fluid(20, 3.2, 30), color: color.ink }}>
            Remember them all!
          </div>
        )}

        {playing && !done && stage === 'pause' && (
          <div
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: fluid(22, 3.6, 34),
              color: lastAnswer === correct ? color.mintInk : color.red,
              animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            {lastAnswer === correct
              ? `Yes — ${correct}!`
              : lastAnswer === null
                ? `Time’s up — it was ${correct}`
                : `Nope — it was ${correct}`}
          </div>
        )}

        {playing && !done && stage === 'answer' && (
          <>
            <div style={{ width: 'min(60vw, 320px)', height: 10, borderRadius: 5, border: border.thin, overflow: 'hidden', background: color.white }}>
              <div style={{ width: `${timeLeft * 100}%`, height: '100%', background: timeLeft < 0.3 ? color.red : color.mint }} />
            </div>
            <input
              // Mounted only while answering, so it takes focus the moment the
              // scene hides and the player can type straight away.
              autoFocus
              value={typed}
              inputMode="numeric"
              autoComplete="off"
              aria-label="How many blocks?"
              placeholder="how many?"
              onChange={(event) => {
                setTyped(event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS))
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitTyped()
              }}
              style={{
                width: 'min(70vw, 260px)',
                boxSizing: 'border-box',
                textAlign: 'center',
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: fluid(30, 5, 48),
                padding: '0.2em 0.3em',
                color: color.ink,
                background: color.white,
                border: border.medium,
                borderRadius: 16,
                outline: 'none',
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
