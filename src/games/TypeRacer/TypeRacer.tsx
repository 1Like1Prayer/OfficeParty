import { useCallback, useEffect, useRef, useState } from 'react'
import { TYPE_RACER } from '../../shared/games/typeRacer/constants.ts'
import { checkpointFractions, totalCharacters } from '../../shared/games/typeRacer/progress.ts'
import type { Paragraph, TypeRacerRound } from '../../shared/games/typeRacer/types.ts'
import { useMediaQuery } from '../../hooks/index.ts'
import { color } from '../../theme/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import type { StationView } from './scene/TypeRacerScene.ts'
import type { TypeRacerScene } from './scene/TypeRacerScene.ts'
import { useSceneSync } from './typing/useSceneSync.ts'
import { useTypingRace } from './typing/useTypingRace.ts'
import { RaceProgressBar, type BarRunner } from './ui/RaceProgressBar.tsx'
import { TypeRacerStage } from './ui/TypeRacerStage.tsx'
import { SwipeAway } from './ui/SwipeAway.tsx'
import { PhoneTypingInput, type PhoneTypingInputHandle } from './ui/PhoneTypingInput.tsx'
import { TypingPanel } from './ui/TypingPanel.tsx'
import { useVisibleViewport } from './ui/useVisibleViewport.ts'
import { useParagraphBreak } from './ui/useParagraphBreak.ts'
import { useParagraphClock } from './ui/useParagraphClock.ts'
import { useSpectator } from './ui/useSpectator.ts'
import { watchedRaceState } from './typing/watchedState.ts'
import { SpectatorHint } from './ui/SpectatorHint.tsx'
import { sfx, useAmbientCalls, useLoop, useSoundOnChange } from '../../audio/sfx/index.ts'

const NO_PARAGRAPHS: readonly Paragraph[] = []

const isRound = (data: unknown): data is TypeRacerRound =>
  typeof data === 'object' &&
  data !== null &&
  Array.isArray((data as TypeRacerRound).paragraphs)

const STATUS_BY_CODE = ['typing', 'finished', 'out'] as const

/** A finger rather than a keyboard: typing goes through a box that brings up the on-screen keyboard. */
const TOUCH = '(pointer: coarse)'
/** A phone-sized screen: the bar and the sheet tighten up so the text keeps the room. */
const NARROW = '(max-width: 600px)'

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
  closingPlayerIds,
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
  // Everyone else is out, so this player has won. The server announces each
  // knock-out from its own replay, so this does not hang on their progress reports.
  const others = players.filter(({ playerId }) => playerId !== selfPlayerId)
  const isLastSurvivor =
    others.length > 0 && others.every(({ playerId }) => progress[playerId]?.status === 2)
  const isTouch = useMediaQuery(TOUCH)
  const isCompact = useMediaQuery(NARROW) || isTouch
  const phoneInputRef = useRef<PhoneTypingInputHandle>(null)
  // A phone's keyboard is up when it hides a good share of the screen. The
  // race bar then folds away, so the paragraph keeps the little room left.
  const visible = useVisibleViewport()
  const isKeyboardUp = isTouch && visible.height < window.innerHeight * 0.75
  const race = useTypingRace({
    paragraphs,
    timingStartsAtLocalMs,
    isRacing,
    isLastSurvivor,
    isClosed: closingPlayerIds !== null,
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

  // The last five seconds of a paragraph tick away; the sea washes round the boards throughout.
  useSoundOnChange(secondsLeft, (next) => {
    if (next !== null && next > 0 && next <= 5 && race.state.status === 'typing') sfx.typeRacer.timerTick({ pitch: 1 + (5 - next) * 0.06 })
  })
  useLoop(sfx.typeRacer.seaLoop, startedRacing || isRacing, 0.6)
  // Gulls wheel over the sea now and then.
  useAmbientCalls(sfx.ambience.seagulls, startedRacing || isRacing, 6_000, 14_000)

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

  // Out of the race: watch the ones still typing, over their shoulder. Click,
  // tap or Space moves on to the next. Watching only; nothing typed counts now.
  const winnerIds = finalRanking?.filter(({ rank }) => rank === 1).map(({ playerId }) => playerId) ?? null
  const isWatching =
    race.state.status === 'out' || (winnerIds !== null && !winnerIds.includes(selfPlayerId))
  const spectator = useSpectator({ isWatching, selfPlayerId, views, winnerIds })
  const { watchedId, next: watchNext } = spectator
  useEffect(() => {
    sceneRef.current?.spectate(watchedId)
  }, [watchedId, sceneReady])
  const canSwitch = isWatching && winnerIds === null && spectator.candidateCount > 1
  useEffect(() => {
    if (!canSwitch) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      event.preventDefault()
      if (!event.repeat) watchNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [canSwitch, watchNext])
  const watchedName = players.find(({ playerId }) => playerId === watchedId)?.name ?? null
  // Their sheet, filling in as they type. A drop in their count is a wrong key: the sheet flashes for it.
  const watchedView = views.find(({ playerId }) => playerId === watchedId) ?? null
  const [watchedSeen, setWatchedSeen] = useState({ id: watchedId, chars: 0, mistakes: 0 })
  const watchedChars = watchedView?.chars ?? 0
  if (watchedSeen.id !== watchedId || watchedSeen.chars !== watchedChars) {
    const isSame = watchedSeen.id === watchedId
    setWatchedSeen({
      id: watchedId,
      chars: watchedChars,
      mistakes: isSame && watchedChars < watchedSeen.chars ? watchedSeen.mistakes + 1 : isSame ? watchedSeen.mistakes : 0,
    })
  }
  const showsWatchedSheet = isWatching && winnerIds === null && watchedView !== null && watchedName !== null

  const runners: BarRunner[] = players.map((player, index) => ({
    player,
    fraction: views[index]!.fraction,
    status: views[index]!.status,
    isYou: player.playerId === selfPlayerId,
  }))

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', cursor: canSwitch ? 'pointer' : undefined }}
      onClick={canSwitch ? watchNext : undefined}
    >
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
          top: isCompact ? 'max(8px, env(safe-area-inset-top))' : 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: isCompact ? 'min(1080px, calc(100% - 16px))' : 'min(1080px, calc(100% - 32px))',
          display: 'flex',
          flexDirection: 'column',
          gap: isCompact ? 6 : 10,
        }}
      >
        <div
          aria-hidden={isKeyboardUp}
          style={{
            display: 'grid',
            gridTemplateRows: isKeyboardUp ? '0fr' : '1fr',
            opacity: isKeyboardUp ? 0 : 1,
            marginBottom: isKeyboardUp ? (isCompact ? -6 : -10) : 0,
            transition: 'grid-template-rows 260ms ease, opacity 200ms ease, margin-bottom 260ms ease',
          }}
        >
          <div style={{ minHeight: 0, overflow: 'hidden' }}>
            <div
              style={{
                background: 'rgba(14, 9, 36, 0.62)',
                border: `3px solid ${color.ink}`,
                borderRadius: 16,
                backdropFilter: 'blur(6px)',
                padding: isCompact ? '4px 0 0' : '8px 0 0',
              }}
            >
              <RaceProgressBar runners={runners} checkpoints={checkpointFractions(paragraphs)} isCompact={isCompact} />
            </div>
          </div>
        </div>
        <SwipeAway isAway={isTypingDone}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Above the sheet, so the keyboard never covers it and the page never has to scroll to it. */}
            {isTouch && (
              <PhoneTypingInput
                ref={phoneInputRef}
                onCharacter={race.typeCharacter}
                isOpen={isRacing && race.state.status === 'typing'}
              />
            )}
            <TypingPanel
              paragraphs={paragraphs}
              state={race.state}
              secondsLeft={secondsLeft}
              isRacing={isRacing}
              breakProgress={breakProgress}
              isCompact={isCompact}
              onTap={isTouch ? () => { phoneInputRef.current?.focus() } : undefined}
            />
          </div>
        </SwipeAway>
        {showsWatchedSheet && (
          // Comes in once the player's own sheet has swiped away; re-keyed per player, so switching writes the new sheet in afresh.
          <div style={{ animation: 'pa-fade-up .4s ease-out .9s both' }}>
          <div key={watchedId} style={{ animation: 'pa-fade-up .35s ease-out both' }}>
            <TypingPanel
              paragraphs={paragraphs}
              state={watchedRaceState(paragraphs, watchedView, watchedSeen.mistakes)}
              secondsLeft={null}
              isRacing
              breakProgress={null}
              isCompact={isCompact}
              watchingName={watchedName}
            />
          </div>
          </div>
        )}
      </div>

      {isWatching && winnerIds === null && watchedName !== null && (
        <SpectatorHint name={watchedName} canSwitch={canSwitch} isTouch={isTouch} />
      )}

      {/* Last in the stack, so the die is the closest thing the player sees. */}
      <div
        ref={setFrontHost}
        style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}
      />
    </div>
  )
}
