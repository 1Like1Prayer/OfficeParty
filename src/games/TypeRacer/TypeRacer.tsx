import { useCallback, useEffect, useRef, useState } from 'react'
import { TYPE_RACER } from '../../shared/games/typeRacer/constants.ts'
import { checkpointFractions, totalCharacters } from '../../shared/games/typeRacer/progress.ts'
import type { Paragraph, TypeRacerRound } from '../../shared/games/typeRacer/types.ts'
import { color } from '../../theme/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import type { StationView } from './scene/TypeRacerScene.ts'
import type { TypeRacerScene } from './scene/TypeRacerScene.ts'
import { useSceneSync } from './typing/useSceneSync.ts'
import { useTypingRace } from './typing/useTypingRace.ts'
import { RaceProgressBar, type BarRunner } from './ui/RaceProgressBar.tsx'
import { TypeRacerStage } from './ui/TypeRacerStage.tsx'
import { SwipeAway } from './ui/SwipeAway.tsx'
import { TypingPanel } from './ui/TypingPanel.tsx'
import { useParagraphBreak } from './ui/useParagraphBreak.ts'
import { useParagraphClock } from './ui/useParagraphClock.ts'

const NO_PARAGRAPHS: readonly Paragraph[] = []

const isRound = (data: unknown): data is TypeRacerRound =>
  typeof data === 'object' &&
  data !== null &&
  Array.isArray((data as TypeRacerRound).paragraphs)

const STATUS_BY_CODE = ['typing', 'finished', 'out'] as const

/**
 * Type Racer Roulette. Everyone types the same paragraphs on an old
 * typewriter, each on a board held up by one wooden block. Three mistakes in a
 * paragraph roll a die of hearts and skulls: a skull and the block crumbles.
 * Run out of time on a paragraph and it crumbles too. First to finish wins.
 *
 * The browser checks every key itself, so typing is instant, and reports what
 * happened; the server replays it and rolls the dice, so the outcome of a roll
 * stays a surprise. The stage here acts the whole thing out.
 */
export function TypeRacer(props: GameSurfaceProps) {
  // A fresh attempt starts the whole session over.
  return <TypeRacerSession key={props.attemptKey} {...props} />
}

function TypeRacerSession({
  phase,
  data,
  players,
  selfPlayerId,
  progress,
  timingStartsAtLocalMs,
  onSubmit,
  onProgress,
  onAction,
  finalRanking,
}: GameSurfaceProps) {
  const paragraphs = isRound(data) ? data.paragraphs : NO_PARAGRAPHS
  const isRacing = phase === 'playing'
  const sceneRef = useRef<TypeRacerScene | null>(null)
  /** Above everything on the screen, text included: where the dice roll is drawn. */
  const [frontHost, setFrontHost] = useState<HTMLDivElement | null>(null)
  // Joining after the start skips the camera's showcase, which has already happened.
  const [startedRacing] = useState(isRacing)

  const requestRoll = useCallback(
    (rollIndex: number) => onAction({ type: 'roll', rollIndex }),
    [onAction],
  )
  // Everyone else is out (their reports say so), so this player has won.
  const others = players.filter(({ playerId }) => playerId !== selfPlayerId)
  const isLastSurvivor =
    others.length > 0 && others.every(({ playerId }) => progress[playerId]?.status === 2)
  const race = useTypingRace({
    paragraphs,
    timingStartsAtLocalMs,
    isRacing,
    isLastSurvivor,
    requestRoll,
    onSubmit,
    onProgress,
  })
  useSceneSync(sceneRef, race.state)

  const total = Math.max(1, totalCharacters(paragraphs))
  const deadlineLocalMs =
    timingStartsAtLocalMs + race.state.paragraphStartedAtMs + TYPE_RACER.PARAGRAPH_TIME_LIMIT_MS
  const rawSecondsLeft = useParagraphClock(
    deadlineLocalMs,
    isRacing && (race.state.status === 'typing' || race.state.status === 'rolling'),
  )
  // During the pause between paragraphs the clock has not started yet: it reads the full allowance.
  const secondsLeft =
    rawSecondsLeft === null ? null : Math.min(rawSecondsLeft, TYPE_RACER.PARAGRAPH_TIME_LIMIT_MS / 1000)

  // The pause after each paragraph but the last: typing is closed, and the screen says so.
  const paragraphNumber = race.state.paragraphIndex
  const [lastBreakShown, setLastBreakShown] = useState(-1)
  const endBreak = useCallback(() => { setLastBreakShown(paragraphNumber) }, [paragraphNumber])
  const breakProgress = useParagraphBreak({
    isBreak: isRacing && paragraphNumber > 0 && lastBreakShown !== paragraphNumber && race.state.status === 'typing',
    startsAtLocalMs: timingStartsAtLocalMs + race.state.pausedFromMs,
    durationMs: TYPE_RACER.PARAGRAPH_PAUSE_MS,
    onDone: endBreak,
  })

  // Everyone's place in the race: this player's own is exact, the others' come
  // from what they report.
  const views: StationView[] = players.map(({ playerId }) => {
    const isYou = playerId === selfPlayerId
    const reported = progress[playerId] ?? {}
    const chars = isYou ? race.chars : (reported.chars ?? 0)
    return {
      playerId,
      chars,
      fraction: Math.min(1, chars / total),
      strikes: isYou ? race.state.strikes : (reported.strikes ?? 0),
      skulls: isYou ? race.progress.skulls : (reported.skulls ?? 1),
      status: isYou
        ? STATUS_BY_CODE[race.progress.status]!
        : (STATUS_BY_CODE[reported.status ?? 0] ?? 'typing'),
    }
  })
  const [sceneReady, setSceneReady] = useState(false)
  const handleScene = useCallback((scene: TypeRacerScene | null) => {
    sceneRef.current = scene
    setSceneReady(scene !== null)
  }, [])
  // Tell the stage what everyone is doing, so it can act out the others' races too.
  const viewsKey = JSON.stringify(views)
  useEffect(() => {
    sceneRef.current?.applyViews(JSON.parse(viewsKey) as StationView[])
  }, [viewsKey, sceneReady])

  // The typing screen has done its job once this player has failed, and once the
  // race is decided: it swipes aside and the stage takes over the screen.
  const isTypingDone = race.state.status === 'out' || finalRanking !== null

  // The race is decided: the winner celebrates and everyone else goes into the water.
  useEffect(() => {
    if (finalRanking === null) return
    const winners = finalRanking.filter(({ rank }) => rank === 1).map(({ playerId }) => playerId)
    sceneRef.current?.finishRace(winners)
  }, [finalRanking, sceneReady])

  // Tell the stage how much of its top the progress bar and text cover.
  const overlayRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const overlay = overlayRef.current
    if (overlay === null || !sceneReady) return
    const report = () => { sceneRef.current?.setTopInset(overlay.getBoundingClientRect().bottom) }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(overlay)
    return () => { observer.disconnect() }
  }, [sceneReady])

  const runners: BarRunner[] = players.map((player, index) => ({
    player,
    fraction: views[index]!.fraction,
    status: views[index]!.status,
    isYou: player.playerId === selfPlayerId,
  }))

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <TypeRacerStage
        players={players}
        selfPlayerId={selfPlayerId}
        skipShowcase={startedRacing}
        frontHost={frontHost}
        onScene={handleScene}
      />

      {/* The progress bar, and under it the text to type. */}
      <div
        ref={overlayRef}
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(1080px, calc(100% - 32px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            background: 'rgba(14, 9, 36, 0.62)',
            border: `3px solid ${color.ink}`,
            borderRadius: 16,
            backdropFilter: 'blur(6px)',
            padding: '8px 0 0',
          }}
        >
          <RaceProgressBar runners={runners} checkpoints={checkpointFractions(paragraphs)} />
        </div>
        <SwipeAway isAway={isTypingDone}>
          <TypingPanel
            paragraphs={paragraphs}
            state={race.state}
            secondsLeft={secondsLeft}
            isRacing={isRacing}
            breakProgress={breakProgress}
          />
        </SwipeAway>
      </div>

      {/* Last in the stack, so the die is the closest thing the player sees. */}
      <div
        ref={setFrontHost}
        style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}
      />
    </div>
  )
}
