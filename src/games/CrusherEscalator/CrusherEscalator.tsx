import { useCallback, useEffect, useRef, useState } from 'react'
import { CRUSHER_ESCALATOR } from '../../shared/games/crusherEscalator/constants.ts'
import { directionAt } from '../../shared/games/crusherEscalator/stream.ts'
import type {
  CrusherEscalatorRound,
  Direction,
  Input,
} from '../../shared/games/crusherEscalator/types.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import type { NextStageView, RoundPlayerView } from '../../types/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import { ArrowPrompt } from './ArrowPrompt.tsx'
import { EscalatorArena } from './arena/EscalatorArena.tsx'
import type { LaneView } from './arena/types.ts'
import { selectRoster } from './roster.ts'
import {
  collectScores,
  countCorrectPresses,
  crushedPlayerIds,
  gapsBehindGroupLeader,
  isCorrectPress,
  slipFraction,
  survivingPlayerIds,
} from './standings.ts'
import { useArrowKeyPresses } from './useArrowKeyPresses.ts'
import { useFallenPlayers } from './useFallenPlayers.ts'
import { useScoreBroadcast } from './useScoreBroadcast.ts'
import { useTabWasHidden } from '../../hooks/useTabWasHidden.ts'

const NO_STREAM: readonly Direction[] = []
const NO_PLAYERS: ReadonlySet<string> = new Set()
/**
 * How long a pressed arrow stays on screen, green or red, before the next one
 * replaces it. Presses are ignored meanwhile: nobody gets to answer an arrow
 * they have not seen yet.
 */
const FEEDBACK_MS = 170
/** Fixed, so a message taking the arrow's place moves nothing. */
const PROMPT_STRIP_HEIGHT = 128
/** The same deep space as the scene, so the strip reads as part of it. */
const BACKDROP_COLOR = '#0a051c'

const isRound = (data: unknown): data is CrusherEscalatorRound =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as CrusherEscalatorRound).streams === 'object' &&
  Array.isArray((data as CrusherEscalatorRound).groups)

const { MAX_INPUTS, MAX_RACE_MS, FINALISTS } = CRUSHER_ESCALATOR

interface StatusInput {
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  isSpectating: boolean
  stage: CrusherEscalatorRound['stage']
  nextStage: NextStageView | null
  selfHasFallen: boolean
  survivorCount: number
  /** Who the server says was left standing, or null while it has not decided. */
  winnerIds: string[] | null
}

/**
 * What the strip says instead of the arrow, or null while the arrow is what
 * the player should be looking at.
 */
function describeStatus(input: StatusInput & { isRaceOver: boolean }): string | null {
  const { players, selfPlayerId, isSpectating, stage, nextStage, selfHasFallen, winnerIds } = input

  if (nextStage !== null) {
    return nextStage.playerIds.includes(selfPlayerId)
      ? 'You’re through to the final!'
      : 'Out in the heats. Watch the final!'
  }
  if (isSpectating) return 'Watching from the sidelines'

  if (winnerIds !== null) {
    const [winnerId] = winnerIds
    if (winnerIds.length !== 1 || winnerId === undefined) return 'Time! Nobody could be shaken off.'
    if (winnerId === selfPlayerId) return 'You’re the last one running!'
    const winnerName = players.find(({ playerId }) => playerId === winnerId)?.name ?? 'Someone'
    return `${winnerName} is the last one running!`
  }

  if (!input.isRaceOver) return null
  if (selfHasFallen) {
    return stage === 'heats' ? 'Swallowed! Waiting for the heat to end…' : 'Swallowed! Waiting for the others…'
  }
  if (stage === 'heats') return 'Heat over! Waiting for the others…'
  return input.survivorCount <= 1 ? 'Last one running!' : 'Time! Locked in…'
}

/**
 * Crusher Escalator. Every player runs up an escalator that carries them
 * down; hitting the arrow that is showing keeps them climbing. Fall far enough
 * behind your group's leader and the black hole at the bottom takes you.
 *
 * With many players the round opens with two heats, shown here as the heat you
 * are racing in. When six are left the heats end, the finalists are set down
 * in their new places on the escalators, and they race again as one group.
 *
 * The browser plays the race on its own clock and reports every press with its
 * time; the server replays all players' presses and decides the outcome. The
 * picture here is a live preview of that, built from our own presses and the
 * other players' score reports. This component stays mounted from one stage to
 * the next so the 3D scene can carry the finalists across, and starts its own
 * state afresh whenever `attemptKey` changes.
 */
export function CrusherEscalator({
  phase,
  data,
  players,
  selfPlayerId,
  progress,
  closingPlayerIds,
  attemptKey,
  nextStage,
  timingStartsAtLocalMs,
  onSubmit,
  onProgress,
  finalRanking,
}: GameSurfaceProps) {
  const isRacing = phase === 'playing'
  const round = isRound(data) ? data : null
  const stage = round?.stage ?? 'final'
  const groups = round?.groups ?? [players.map(({ playerId }) => playerId)]
  const isSpectating = !players.some(({ playerId }) => playerId === selfPlayerId)
  const stream = (round?.streams[selfPlayerId]) ?? NO_STREAM

  const [inputs, setInputs] = useState<Input[]>([])
  const [isTimeUp, setIsTimeUp] = useState(false)
  // How many presses had been made when the arrow was last flashed.
  const [flashedPressCount, setFlashedPressCount] = useState<number | null>(null)
  const [seenAttemptKey, setSeenAttemptKey] = useState(attemptKey)
  const submittedAttemptKey = useRef<string | null>(null)
  const tabWasHidden = useTabWasHidden(isRacing)

  // A new attempt (the final after the heats, a tiebreaker) starts from nothing.
  if (seenAttemptKey !== attemptKey) {
    setSeenAttemptKey(attemptKey)
    setInputs([])
    setIsTimeUp(false)
    setFlashedPressCount(null)
  }

  const score = countCorrectPresses(inputs, stream)
  const scores = collectScores({ players, selfPlayerId, selfScore: score, progress })
  const gaps = gapsBehindGroupLeader(scores, groups)
  // Once the race is called, the players still standing have won: no late score
  // report can take them back down.
  const winnersByServer = finalRanking === null ? NO_PLAYERS : new Set(survivingPlayerIds(finalRanking))
  const safeIds = closingPlayerIds === null ? winnersByServer : new Set([...winnersByServer, ...closingPlayerIds])
  const fallenPlayers = useFallenPlayers(gaps, attemptKey, safeIds)

  // Once the server has decided the race its replay is the truth: anyone it
  // crushed goes into the hole now, even if this screen had not seen it coming.
  // Players it sends through to the next stage are not crushed, whatever this
  // screen guessed.
  const goingThrough = new Set(nextStage?.playerIds)
  const crushedByServer = finalRanking === null ? NO_PLAYERS : crushedPlayerIds(finalRanking)
  const hasFallen = (playerId: string): boolean =>
    !goingThrough.has(playerId) && (fallenPlayers.has(playerId) || crushedByServer.has(playerId))

  const selfHasFallen = hasFallen(selfPlayerId)
  const survivorCount = players.filter(({ playerId }) => !hasFallen(playerId)).length
  // The heats end when the finalists are decided, the final when one is left.
  const survivorsToEnd = stage === 'heats' ? FINALISTS : 1
  // The server calls the race once enough players have reported, whatever this
  // screen has been told by progress reports (which can be late or dropped).
  const isRaceOver =
    finalRanking !== null ||
    isTimeUp ||
    selfHasFallen ||
    survivorCount <= survivorsToEnd ||
    closingPlayerIds !== null
  const isFlashingPress = flashedPressCount === inputs.length && inputs.length > 0
  const acceptsInput = isRacing && !isRaceOver && stream.length > 0 && !isFlashingPress

  const recordPress = useCallback(
    (direction: Direction) => {
      const atMs = Math.round(performance.now() - timingStartsAtLocalMs)
      // The server refuses a result with more presses, or later ones, than this.
      if (atMs < 0 || atMs > MAX_RACE_MS) return
      if (inputs.length >= MAX_INPUTS) return
      setInputs([...inputs, { direction, atMs }])
      setFlashedPressCount(inputs.length + 1)
    },
    [inputs, timingStartsAtLocalMs],
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
  const feedback =
    isFlashingPress && lastInput !== undefined
      ? isCorrectPress(lastInput, stream, inputs.length - 1)
        ? 'correct'
        : 'wrong'
      : null

  // The last runner in the final has won: they jump on the spot and nothing touches them.
  const isFinalDecided =
    stage === 'final' && nextStage === null && (finalRanking !== null || closingPlayerIds !== null || survivorCount <= 1)
  const winnerIds = new Set(
    isFinalDecided
      ? finalRanking !== null
        ? survivingPlayerIds(finalRanking)
        : players.filter(({ playerId }) => !hasFallen(playerId)).map(({ playerId }) => playerId)
      : [],
  )
  const hasSoleWinner = winnerIds.size === 1

  const roster = selectRoster({ round, players, nextStage, selfPlayerId })
  const lanes: LaneView[] = roster.map(({ playerId }) => {
    // Between stages the finalists are being set down for a fresh start.
    if (nextStage !== null) {
      return { playerId, score: 0, gap: 0, slip: 0, isFallen: false, isYou: playerId === selfPlayerId }
    }
    const gap = gaps[playerId] ?? 0
    return {
      playerId,
      score: scores[playerId] ?? 0,
      gap,
      slip: slipFraction(gap),
      isFallen: hasFallen(playerId),
      isWinner: hasSoleWinner && winnerIds.has(playerId),
      isYou: playerId === selfPlayerId,
    }
  })

  const statusMessage = describeStatus({
    players,
    selfPlayerId,
    isSpectating,
    stage,
    nextStage,
    selfHasFallen,
    survivorCount,
    isRaceOver,
    winnerIds: finalRanking === null || nextStage !== null ? null : survivingPlayerIds(finalRanking),
  })

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
          background: BACKDROP_COLOR,
          borderBottom: `3px solid ${color.ink}`,
        }}
      >
        {statusMessage !== null && (isRacing || isSpectating) ? (
          <div
            key={statusMessage}
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 28,
              color: selfHasFallen && nextStage === null ? '#FF7A72' : color.green,
              animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            {statusMessage}
          </div>
        ) : (
          <>
            <ArrowPrompt
              direction={acceptsInput || isFlashingPress ? directionAt(stream, shownPressIndex) : null}
              feedback={feedback}
            />
            <div style={{ ...sharedStyles.microLabel, fontSize: 12, color: color.mutedSoft }}>
              {stage === 'heats' ? `HEAT · LAST ${FINALISTS} STANDING GO THROUGH` : 'ARROW KEYS OR WASD'}
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <EscalatorArena players={roster} lanes={lanes} isRacing={isRacing} introduce={stage === 'heats'} />
      </div>
    </div>
  )
}
