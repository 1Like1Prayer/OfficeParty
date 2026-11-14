import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { CUBE_COUNTER, MAX_POSSIBLE_BOX_COUNT } from '../../shared/games/cubeCounter/constants.ts'
import { countBlocks } from '../../shared/games/cubeCounter/sceneValidation.ts'
import type { Answer, CubeCounterRound } from '../../shared/games/cubeCounter/types.ts'
import { PushButton } from '../../components/ui/index.ts'
import { border, color, fluid, font, sharedStyles } from '../../theme/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import { useElapsed } from '../StopTheClock/useElapsed.ts'
import { IsoScene } from './IsoScene.tsx'
import { SCENE_ASPECT } from './projection.ts'

/**
 * The scene is sized by the screen's height, because height is what the round
 * runs out of: it takes what is left once the play screen's padding, cue and
 * status line and this game's label and answer area have their room. That
 * room grows with the screen's width, like the rest of the theme, which is why
 * it is a `fluid()` too. Capped by the width as well, so it never spills off a
 * phone held upright, and never shrinks past readable.
 */
const SCENE_MAX_VH = 46
const SCENE_RESERVED = fluid(330, 470)
const SCENE_MIN_HEIGHT_PX = 150
const SCENE_MAX_PX = 520
const sceneHeight = `max(${SCENE_MIN_HEIGHT_PX}px, min(${SCENE_MAX_VH}vh, 100dvh - ${SCENE_RESERVED}))`

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

  // Blank until the first puzzle; its box keeps its height so nothing moves.
  let headline = ''
  if (playing && !done) headline = `PUZZLE ${Math.min(index + 1, puzzles.length)} / ${puzzles.length}`
  if (done) headline = 'ALL DONE'

  const message: CSSProperties = {
    fontFamily: font.display,
    fontWeight: 700,
    fontSize: fluid(20, 30),
    lineHeight: 1.2,
    textWrap: 'balance',
    maxWidth: '100%',
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: fluid(10, 16),
        width: '100%',
        maxWidth: 640,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          ...sharedStyles.microLabel,
          letterSpacing: '0.22em',
          fontSize: playing ? fluid(14, 17) : fluid(12, 15),
          color: playing ? color.ink : color.mutedStrong,
          // A fixed height, because the type size changes and the scene sits below it.
          height: fluid(22, 28),
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {headline}
      </div>

      {/* Reserved whether or not a scene is showing, so the parts around it
          never move as the round goes from flash to answer and back. */}
      <div
        style={{
          position: 'relative',
          width: `min(100%, calc(${sceneHeight} * ${SCENE_ASPECT}), ${SCENE_MAX_PX}px)`,
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
              // Scaled to the scene box it stands in for.
              fontSize: `min(${fluid(64, 120)}, calc(${sceneHeight} * 0.35))`,
              color: color.mutedSoft,
            }}
          >
            ?
          </div>
        )}
      </div>

      {/* Reserved from the start: the answer box appearing must not push the
          scene up the screen. Sized for the tallest thing it holds, the answer. */}
      <div
        style={{
          minHeight: fluid(112, 136),
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: fluid(8, 12),
        }}
      >
        {playing && done && (
          <div style={{ ...message, color: color.mutedStrong, animation: 'pa-pulse 2s ease-in-out infinite' }}>
            Locked in. Waiting for everyone else…
          </div>
        )}

        {playing && !done && stage === 'flash' && (
          <div style={{ ...message, color: color.ink }}>Remember them all!</div>
        )}

        {playing && !done && stage === 'pause' && (
          <div
            style={{
              ...message,
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
            <div
              style={{
                width: fluid(220, 300),
                maxWidth: '100%',
                height: 10,
                borderRadius: 5,
                border: border.thin,
                overflow: 'hidden',
                background: color.white,
              }}
            >
              <div style={{ width: `${timeLeft * 100}%`, height: '100%', background: timeLeft < 0.3 ? color.red : color.mint }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: fluid(8, 12), maxWidth: '100%' }}>
              <input
                // Mounted only while answering, so it takes focus the moment the
                // scene hides and the player can type straight away.
                autoFocus
                value={typed}
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                aria-label="How many blocks?"
                onChange={(event) => {
                  setTyped(event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS))
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitTyped()
                }}
                style={{
                  width: fluid(140, 200),
                  minWidth: 0,
                  flexShrink: 1,
                  boxSizing: 'border-box',
                  textAlign: 'center',
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: fluid(28, 40),
                  padding: '0.15em 0.3em',
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
            <div style={{ fontFamily: font.mono, fontSize: fluid(11, 13), color: color.mutedStrong }}>
              TYPE IT, THEN HIT ENTER OR OK
            </div>
          </>
        )}
      </div>
    </div>
  )
}
