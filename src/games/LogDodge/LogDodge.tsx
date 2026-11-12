import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LOG_DODGE } from '../../shared/games/logDodge/constants.ts'
import { judgePlayer } from '../../shared/games/logDodge/judge.ts'
import type { Action, Input, LogDodgeRound } from '../../shared/games/logDodge/types.ts'
import { useTabWasHidden } from '../../hooks/useTabWasHidden.ts'
import { useThrottledReport } from '../../hooks/useThrottledReport.ts'
import type { GameSurfaceProps } from '../types.ts'
import { Hud } from './Hud.tsx'
import { LogDodgeStage, type LogDodgeStageHandle } from './LogDodgeStage.tsx'
import { pickVisiblePlayers } from './roster.ts'
import { collectStatuses, describeStatus, lastStanding, survivorsOf } from './standings.ts'
import { useActionKeys } from './useActionKeys.ts'
import { useRoundElapsed } from './useRoundElapsed.ts'

const isRound = (data: unknown): data is LogDodgeRound =>
  typeof data === 'object' &&
  data !== null &&
  Array.isArray((data as LogDodgeRound).logs) &&
  typeof (data as LogDodgeRound).durationMs === 'number'

/**
 * Log Dodge. Everyone runs on one giant treadmill while the same logs sweep
 * in from the far end, low, middle and high. Jump the low ones, duck the high
 * ones, and split in half to let the middle ones through. Three hits and you
 * are thrown off the back; whoever is still standing at the end wins.
 *
 * The browser plays the round on its own clock and reports every press with
 * its time; the server replays them against the schedule and decides who was
 * hit. The picture here is a live preview of that, judged by the same rules.
 * It opens high above the whole field and swoops in behind the player.
 */
export function LogDodge(props: GameSurfaceProps) {
  const round = isRound(props.data) ? props.data : null
  if (round === null) return null
  // A fresh attempt — a tiebreaker — is a fresh round, so it starts everything over.
  return <LogDodgeRun key={props.attemptKey} {...props} round={round} />
}

function LogDodgeRun({
  phase,
  round,
  players,
  selfPlayerId,
  progress,
  closingPlayerIds,
  timingStartsAtLocalMs,
  onSubmit,
  onProgress,
  finalRanking,
}: GameSurfaceProps & { round: LogDodgeRound }) {
  const isPlaying = phase === 'playing'
  const isSpectating = !players.some(({ playerId }) => playerId === selfPlayerId)
  const stageRef = useRef<LogDodgeStageHandle>(null)
  const submitted = useRef(false)
  const tabWasHidden = useTabWasHidden(isPlaying)

  // The round's own clock, which keeps running even if the player has switched tabs.
  const elapsedMs = useRoundElapsed(timingStartsAtLocalMs, round.durationMs)

  // Judged by the server's own rules, over the logs whose window has closed.
  const [inputs, setInputs] = useState<Input[]>([])
  // Once the round is decided no more logs come: whatever had not yet reached the
  // contestants is gone, so it can never count against anyone (the server ignores
  // it too).
  const [stoppedAtMs, setStoppedAtMs] = useState<number | null>(null)
  const closedLogs = round.logs.filter(
    (log) =>
      log.arriveAtMs + LOG_DODGE.HIT_WINDOW_MS <= elapsedMs &&
      (stoppedAtMs === null || log.arriveAtMs <= stoppedAtMs),
  )
  const outcome = judgePlayer(closedLogs, inputs)
  const isOut = outcome.eliminatedAtMs !== null
  const isTimeUp = elapsedMs >= round.durationMs
  // Everyone else knocked out: the round is won, so this player reports now rather than
  // making the room wait out the clock. The server stops the logs at that moment, and
  // ignores anything this player did after it.
  const reported = lastStanding({ players, selfPlayerId, selfIsOut: isOut, progress })
  // The server saying that only this player is still playing is the surest sign
  // of all, and does not depend on anyone's progress reports having arrived.
  const isClosedOnSelf = !isOut && !isSpectating && (closingPlayerIds?.includes(selfPlayerId) ?? false)
  const standing = isClosedOnSelf ? { isRoundOver: true, winnerId: selfPlayerId } : reported
  const isRoundOver = standing.isRoundOver || closingPlayerIds !== null
  if (stoppedAtMs === null && isRoundOver && elapsedMs > 0) setStoppedAtMs(elapsedMs)
  const isLastStanding = !isSpectating && standing.winnerId === selfPlayerId
  const isOver = isOut || isTimeUp || isLastStanding

  const recordPress = useCallback(
    (action: Action) => {
      const atMs = Math.round(performance.now() - timingStartsAtLocalMs)
      // The server refuses a result with later or more presses than this.
      if (atMs < 0 || atMs > round.durationMs) return
      if (inputs.length >= LOG_DODGE.MAX_INPUTS) return
      // A press inside the cooldown does nothing, here as on the server, so it is not sent.
      const previous = inputs.at(-1)
      if (previous !== undefined && atMs - previous.atMs < LOG_DODGE.INPUT_COOLDOWN_MS) return
      setInputs([...inputs, { action, atMs }])
      stageRef.current?.press(action, atMs)
    },
    [inputs, timingStartsAtLocalMs, round.durationMs],
  )
  useActionKeys(isPlaying && !isOver && !isSpectating, recordPress)

  // Everyone else sees how many hits this player has taken.
  const hitsReport = useMemo(() => ({ hits: outcome.hits }), [outcome.hits])
  useThrottledReport(hitsReport, isPlaying && !isSpectating, onProgress)

  // Report once, as soon as this player's round is decided. The server replays
  // the presses itself, so nothing here claims an outcome.
  useEffect(() => {
    if (submitted.current || isSpectating || !isPlaying || !isOver) return
    submitted.current = true
    onSubmit({ inputs, timingSuspect: tabWasHidden })
  }, [isSpectating, isPlaying, isOver, inputs, tabWasHidden, onSubmit])

  const visiblePlayers = pickVisiblePlayers(players, selfPlayerId)
  const status = {
    byPlayerId: collectStatuses({
      players: visiblePlayers,
      selfPlayerId,
      selfHits: outcome.hits,
      selfIsOut: isOut,
      progress,
      finalRanking,
    }),
    selfEnded: isOver || finalRanking !== null,
    isRoundOver: isRoundOver || finalRanking !== null,
    // The winner jumps for joy: as soon as the others are all out, then as the server confirms.
    survivorIds:
      survivorsOf(finalRanking) ??
      (standing.winnerId === null ? null : new Set([standing.winnerId])),
  }
  const lastPress = inputs.at(-1) ?? null

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LogDodgeStage
        ref={stageRef}
        players={visiblePlayers}
        selfPlayerId={selfPlayerId}
        logs={round.logs}
        timingStartsAtLocalMs={timingStartsAtLocalMs}
        status={status}
      />
      <Hud
        elapsedMs={elapsedMs}
        durationMs={round.durationMs}
        hits={outcome.hits}
        isOut={isOut}
        hasKeys={!isSpectating}
        lastPress={lastPress}
        readyAtMs={lastPress === null ? -Infinity : lastPress.atMs + LOG_DODGE.INPUT_COOLDOWN_MS}
        message={describeStatus({
          players,
          selfPlayerId,
          isSpectating,
          isOut,
          isTimeUp,
          lastStandingId: standing.winnerId,
          finalRanking,
        })}
      />
    </div>
  )
}
