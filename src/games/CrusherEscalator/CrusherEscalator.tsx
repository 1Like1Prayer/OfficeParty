import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CRUSHER_ESCALATOR } from '../../shared/games/crusherEscalator/constants.ts'
import { arrowSequence } from '../../shared/games/crusherEscalator/stream.ts'
import type {
  CrusherEscalatorRound,
  Direction,
  Input,
} from '../../shared/games/crusherEscalator/types.ts'
import { useMediaQuery } from '../../hooks/index.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import type { RoundPlayerView } from '../../types/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import { ArrowPad } from './ArrowPad.tsx'
import { ArrowPrompt, type PressFeedback } from './ArrowPrompt.tsx'
import { COMPACT_SCREEN, FOCUS_LANES } from './arena/arenaConfig.ts'
import { EscalatorArena } from './arena/EscalatorArena.tsx'
import type { LaneView } from './arena/types.ts'
import { selectRoster } from './roster.ts'
import {
  collectScores,
  countCorrectPresses,
  crushedPlayerIds,
  gapsBehindLeader,
  isCorrectPress,
  slipFraction,
  survivingPlayerIds,
} from './standings.ts'
import { useArrowKeyPresses } from './useArrowKeyPresses.ts'
import { useEliminationGap } from './useEliminationGap.ts'
import { useFallenPlayers } from './useFallenPlayers.ts'
import { useScoreBroadcast } from './useScoreBroadcast.ts'
import { useTabWasHidden } from '../../hooks/useTabWasHidden.ts'
import { sfx, useLoop, useSoundOnChange } from '../../audio/sfx/index.ts'

const NO_PLAYERS: ReadonlySet<string> = new Set()
/**
 * How long a pressed arrow stays on screen, green or red, before the next one
 * replaces it. Presses are ignored meanwhile: nobody gets to answer an arrow
 * they have not seen yet.
 */
const FEEDBACK_MS = 170
/**
 * Fixed for a given screen, so a message taking the arrow's place moves
 * nothing; shorter on a short screen, so the arena keeps its share.
 */
const PROMPT_STRIP_HEIGHT = 'clamp(84px, 17dvh, 128px)'
const PROMPT_ARROW_SIZE = 'clamp(48px, 11dvh, 92px)'
/** A finger rather than a mouse: the arrows get buttons of their own. */
const TOUCH = '(pointer: coarse)'
/** The same deep space as the scene, so the strip reads as part of it. */
const BACKDROP_COLOR = '#0a051c'

const isRound = (data: unknown): data is CrusherEscalatorRound =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as CrusherEscalatorRound).seeds === 'object' &&
  (data as CrusherEscalatorRound).seeds !== null

const { MAX_INPUTS, MAX_RACE_MS } = CRUSHER_ESCALATOR

interface StatusInput {
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  isSpectating: boolean
  selfHasFallen: boolean
  survivorCount: number
  isRaceOver: boolean
  /** Who the server says was left standing, or null while it has not decided. */
  winnerIds: string[] | null
}

/**
 * What the strip says instead of the arrow, or null while the arrow is what
 * the player should be looking at.
 */
function describeStatus(input: StatusInput): string | null {
  const { players, selfPlayerId, isSpectating, selfHasFallen, winnerIds } = input

  if (isSpectating) return 'Watching from the sidelines'

  if (winnerIds !== null) {
    const [winnerId] = winnerIds
    if (winnerIds.length !== 1 || winnerId === undefined) return 'Time! Nobody could be shaken off.'
    if (winnerId === selfPlayerId) return 'You’re the last one running!'
    const winnerName = players.find(({ playerId }) => playerId === winnerId)?.name ?? 'Someone'
    return `${winnerName} is the last one running!`
  }

  if (!input.isRaceOver) return null
  if (selfHasFallen) return 'Swallowed! Waiting for the others…'
  return input.survivorCount <= 1 ? 'Last one running!' : 'Time! Locked in…'
}

/**
 * Crusher Escalator. Every player runs up an escalator that carries them
 * down; hitting the arrow that is showing keeps them climbing. Fall far enough
 * behind the leader and the black hole at the bottom takes you. How far is
 * "far enough" narrows as the race goes on, so nobody can hang on forever.
 *
 * The browser plays the race on its own clock and reports every press with its
 * time; the server replays all players' presses and decides the outcome. The
 * picture here is a live preview of that, built from our own presses and the
 * other players' score reports. Each player's arrows come from a seed in the
 * round data, expanded by the same shared code the server judges with. This
 * component starts its own state afresh whenever `attemptKey` changes (a
 * tiebreaker).
 */
export function CrusherEscalator({
  phase,
  data,
  players,
  selfPlayerId,
  progress,
  closingPlayerIds,
  attemptKey,
  timingStartsAtLocalMs,
  onSubmit,
  onProgress,
  finalRanking,
}: GameSurfaceProps) {
  const isRacing = phase === 'playing'
  const round = isRound(data) ? data : null
  const isSpectating = !players.some(({ playerId }) => playerId === selfPlayerId)
  const seed = round?.seeds[selfPlayerId]
  const arrows = useMemo(() => (seed === undefined ? null : arrowSequence(seed)), [seed])

  const [inputs, setInputs] = useState<Input[]>([])
  const [isTimeUp, setIsTimeUp] = useState(false)
  // How many presses had been made when the arrow was last flashed.
  const [flashedPressCount, setFlashedPressCount] = useState<number | null>(null)
  const [seenAttemptKey, setSeenAttemptKey] = useState(attemptKey)
  const submittedAttemptKey = useRef<string | null>(null)
  const tabWasHidden = useTabWasHidden(isRacing)
  const isPortrait = useMediaQuery('(orientation: portrait)')
  const isCompact = useMediaQuery(COMPACT_SCREEN)
  const isTouch = useMediaQuery(TOUCH)
  const eliminationGap = useEliminationGap(isRacing, timingStartsAtLocalMs)

  // A new attempt (a tiebreaker) starts from nothing.
  if (seenAttemptKey !== attemptKey) {
    setSeenAttemptKey(attemptKey)
    setInputs([])
    setIsTimeUp(false)
    setFlashedPressCount(null)
  }

  const score = arrows === null ? 0 : countCorrectPresses(inputs, arrows)
  const scores = collectScores({ players, selfPlayerId, selfScore: score, progress })
  const gaps = gapsBehindLeader(scores)
  // Once the race is called, the players still standing have won: no late score
  // report can take them back down.
  const winnersByServer = finalRanking === null ? NO_PLAYERS : new Set(survivingPlayerIds(finalRanking))
  const safeIds = closingPlayerIds === null ? winnersByServer : new Set([...winnersByServer, ...closingPlayerIds])
  const fallenPlayers = useFallenPlayers(gaps, eliminationGap, attemptKey, safeIds)

  // Once the server has decided the race its replay is the truth: anyone it
  // crushed goes into the hole now, even if this screen had not seen it coming.
  const crushedByServer = finalRanking === null ? NO_PLAYERS : crushedPlayerIds(finalRanking)
  const hasFallen = (playerId: string): boolean =>
    fallenPlayers.has(playerId) || crushedByServer.has(playerId)

  const selfHasFallen = hasFallen(selfPlayerId)
  const survivorCount = players.filter(({ playerId }) => !hasFallen(playerId)).length
  // The server calls the race once enough players have reported, whatever this
  // screen has been told by progress reports (which can be late or dropped).
  const isRaceOver =
    finalRanking !== null ||
    isTimeUp ||
    selfHasFallen ||
    survivorCount <= 1 ||
    closingPlayerIds !== null
  const isFlashingPress = flashedPressCount === inputs.length && inputs.length > 0
  const acceptsInput = isRacing && !isRaceOver && arrows !== null && !isFlashingPress

  const recordPress = useCallback(
    (direction: Direction) => {
      const atMs = Math.round(performance.now() - timingStartsAtLocalMs)
      // The server refuses a result with more presses, or later ones, than this.
      if (atMs < 0 || atMs > MAX_RACE_MS) return
      if (inputs.length >= MAX_INPUTS) return
      const input = { direction, atMs }
      if (arrows !== null && isCorrectPress(input, arrows, inputs.length)) sfx.crusherEscalator.step(countCorrectPresses(inputs, arrows))
      else sfx.crusherEscalator.wrong()
      setInputs([...inputs, input])
      setFlashedPressCount(inputs.length + 1)
    },
    [inputs, timingStartsAtLocalMs, arrows],
  )
  useArrowKeyPresses(acceptsInput, recordPress)
  useScoreBroadcast(score, isRacing && !isSpectating, onProgress)

  useEffect(() => {
    if (flashedPressCount === null) return
    const timer = setTimeout(() => { setFlashedPressCount(null) }, FEEDBACK_MS)
    return () => { clearTimeout(timer) }
  }, [flashedPressCount])

  // The race has a hard time cap, whether or not anyone has fallen.
  useEffect(() => {
    if (!isRacing) return
    const msLeft = timingStartsAtLocalMs + MAX_RACE_MS - performance.now()
    const timer = setTimeout(() => { setIsTimeUp(true) }, Math.max(0, msLeft))
    return () => { clearTimeout(timer) }
  }, [isRacing, timingStartsAtLocalMs])

  // Report once per attempt, as soon as this player's race is decided. The
  // server replays the presses itself, so nothing here claims an outcome.
  useEffect(() => {
    if (isSpectating || !isRaceOver || !isRacing) return
    if (submittedAttemptKey.current === attemptKey) return
    submittedAttemptKey.current = attemptKey
    onSubmit({ inputs, timingSuspect: tabWasHidden })
  }, [isSpectating, isRaceOver, isRacing, attemptKey, inputs, tabWasHidden, onSubmit])

  // While a press is being flashed the arrow shown is the one that was pressed.
  const shownPressIndex = isFlashingPress ? inputs.length - 1 : inputs.length
  const lastInput = inputs.at(-1)
  const feedback: PressFeedback | null =
    isFlashingPress && lastInput !== undefined && arrows !== null
      ? isCorrectPress(lastInput, arrows, inputs.length - 1)
        ? 'correct'
        : 'wrong'
      : null

  // The last runner has won: they jump on the spot and nothing touches them.
  const isDecided = finalRanking !== null || closingPlayerIds !== null || survivorCount <= 1
  const winnerIds = new Set(
    isDecided
      ? finalRanking !== null
        ? survivingPlayerIds(finalRanking)
        : players.filter(({ playerId }) => !hasFallen(playerId)).map(({ playerId }) => playerId)
      : [],
  )
  const hasSoleWinner = winnerIds.size === 1

  // The black hole hums louder and higher the nearer anyone is to its edge; the
  // escalator's machinery runs under it while this player is still climbing.
  const danger = Math.max(0, ...players.filter(({ playerId }) => !hasFallen(playerId)).map(({ playerId }) => slipFraction(gaps[playerId] ?? 0, eliminationGap)))
  useLoop(sfx.crusherEscalator.blackHoleLoop, isRacing && !isRaceOver, 0.25 + 0.75 * danger, 1 + danger * 0.6)
  useLoop(sfx.crusherEscalator.escalatorLoop, isRacing && !isRaceOver && !isSpectating, 0.6)
  useSoundOnChange(eliminationGap, (next, previous) => { if (isRacing && next < previous) sfx.crusherEscalator.gapNarrows() })
  // Swallowed: the full dive for this player, a short blip for anyone else.
  const fallenKey = players.filter(({ playerId }) => hasFallen(playerId)).map(({ playerId }) => playerId).join(' ')
  useSoundOnChange(fallenKey, (next, previous) => {
    const before = new Set(previous.split(' '))
    const newly = next.split(' ').filter((playerId) => playerId !== '' && !before.has(playerId))
    if (newly.includes(selfPlayerId)) sfx.crusherEscalator.swallowed()
    else if (newly.length > 0) sfx.flow.eliminated({ volume: 0.6 })
  })
  useSoundOnChange(hasSoleWinner && winnerIds.has(selfPlayerId), (isWinner) => { if (isWinner) sfx.flow.youWon() })

  const roster = selectRoster({ players, isOut: hasFallen })
  const lanes: LaneView[] = players.map(({ playerId }) => {
    return {
      playerId,
      score: scores[playerId] ?? 0,
      slip: slipFraction(gaps[playerId] ?? 0, eliminationGap),
      isFallen: hasFallen(playerId),
      isWinner: hasSoleWinner && winnerIds.has(playerId),
      isYou: playerId === selfPlayerId,
    }
  })

  const statusMessage = describeStatus({
    players,
    selfPlayerId,
    isSpectating,
    selfHasFallen,
    survivorCount,
    isRaceOver,
    winnerIds: finalRanking === null ? null : survivingPlayerIds(finalRanking),
  })

  const padFlash =
    feedback !== null && lastInput !== undefined ? { direction: lastInput.direction, feedback } : null
  // Live for the whole race, so the pad does not flicker with every press; a tap
  // while the last press is still being shown is ignored, as a key would be.
  const canPress = isRacing && !isRaceOver && arrows !== null && !isSpectating
  const onPadPress = canPress
    ? (direction: Direction) => { if (!isFlashingPress) recordPress(direction) }
    : null
  const hasPad = isTouch && !isSpectating
  const arena = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      <EscalatorArena
        players={roster}
        lanes={lanes}
        attemptKey={attemptKey}
        isRacing={isRacing}
        timingStartsAtLocalMs={timingStartsAtLocalMs}
        focusLaneCount={isCompact ? FOCUS_LANES.COMPACT : FOCUS_LANES.FULL}
      />
    </div>
  )

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Its own strip, so the arrow is never drawn over the scene. */}
      <div
        style={{
          height: PROMPT_STRIP_HEIGHT,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '0 16px',
          background: BACKDROP_COLOR,
          borderBottom: `3px solid ${color.ink}`,
          textAlign: 'center',
        }}
      >
        {statusMessage !== null && (isRacing || isSpectating) ? (
          <div
            key={statusMessage}
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 'clamp(18px, 5vw, 28px)',
              lineHeight: 1.15,
              color: selfHasFallen ? '#FF7A72' : color.green,
              animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            {statusMessage}
          </div>
        ) : (
          <>
            <ArrowPrompt
              direction={(acceptsInput || isFlashingPress) && arrows !== null ? arrows(shownPressIndex) : null}
              feedback={feedback}
              size={PROMPT_ARROW_SIZE}
            />
            <div style={{ ...sharedStyles.microLabel, fontSize: 'clamp(10px, 2.6vw, 12px)', color: color.mutedSoft }}>
              {isTouch ? 'TAP THE ARROWS' : 'ARROW KEYS OR WASD'} ·{' '}
              {/* Keyed on the gap, so it pops each time the gap narrows. */}
              <span
                key={eliminationGap}
                style={{ display: 'inline-block', color: color.cream, animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)' }}
              >
                CRUSHED AT {eliminationGap} BEHIND
              </span>
            </div>
          </>
        )}
      </div>

      {/* On a phone the arrows get buttons beside the arena, never over it. */}
      {hasPad && !isPortrait ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <ArrowPad placement="left" onPress={onPadPress} flash={padFlash} />
          {arena}
          <ArrowPad placement="right" onPress={onPadPress} flash={padFlash} />
        </div>
      ) : (
        arena
      )}
      {hasPad && isPortrait && <ArrowPad placement="row" onPress={onPadPress} flash={padFlash} />}
    </div>
  )
}
