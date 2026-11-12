import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTabWasHidden } from '../../hooks/useTabWasHidden.ts'
import { useThrottledReport } from '../../hooks/useThrottledReport.ts'
import { MINEFIELD } from '../../shared/games/minefield/constants.ts'
import { revealedMines, simulateRun, type Scan } from '../../shared/games/minefield/simulate.ts'
import type { Axis, Input, MinefieldRound } from '../../shared/games/minefield/types.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import { useRoundElapsed } from '../LogDodge/useRoundElapsed.ts'
import type { Blast, FieldFrame, Racer } from './fieldFrame.ts'
import { MinefieldStage } from './MinefieldStage.tsx'
import { useHeldKeys } from './useHeldKeys.ts'

const isRound = (data: unknown): data is MinefieldRound =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as MinefieldRound).map === 'object' &&
  Array.isArray((data as MinefieldRound).map?.mines)

/** More scans than a race could hold; the bound the server checks reports against. */
const MAX_SCANS = Math.ceil(MINEFIELD.MAX_RACE_MS / MINEFIELD.SONAR_COOLDOWN_MS) + 1

interface SeenScan extends Scan {
  playerId: string
  count: number
}

const formatClock = (ms: number): string => {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Minefield. Everyone races the same hidden field from the start to the finish
 * line. Walking within a mine's trigger radius sets it off and costs a life;
 * the second one takes you out. Space sends a sonar pulse that shows the mines
 * nearby to everyone, at the price of standing still while it scans.
 *
 * The browser runs its own race and reports every direction change and sonar
 * press with a time; the server replays everyone together with the same code
 * (`simulateRun` here), so what this screen shows of your own run is the
 * result, and what it shows of the others is a preview built from their
 * reports.
 */
export function Minefield(props: GameSurfaceProps) {
  const round = isRound(props.data) ? props.data : null
  if (round === null) return null
  return <MinefieldRun key={props.attemptKey} {...props} round={round} />
}

function MinefieldRun({
  phase,
  round,
  players,
  selfPlayerId,
  progress,
  closingPlayerIds,
  finalRanking,
  timingStartsAtLocalMs,
  onSubmit,
  onProgress,
}: GameSurfaceProps & { round: MinefieldRound }) {
  const { map } = round
  const isPlaying = phase === 'playing'
  const isSpectating = !players.some(({ playerId }) => playerId === selfPlayerId)
  const submitted = useRef(false)
  const tabWasHidden = useTabWasHidden(isPlaying)

  const elapsedMs = useRoundElapsed(timingStartsAtLocalMs, MINEFIELD.MAX_RACE_MS)
  const raceMs = Math.max(0, elapsedMs)
  const others = players.filter(({ playerId }) => playerId !== selfPlayerId)

  /* ---------------- what the others have done, from their reports ---------------- */

  // A mine another runner set off is gone for this one too, and their scans show
  // everyone what they found. Both arrive as progress reports, noted once each as
  // they appear.
  const [blastLog, setBlastLog] = useState<{ index: number; atMs: number }[]>([])
  const [scanLog, setScanLog] = useState<SeenScan[]>([])
  const newBlasts = others.flatMap(({ playerId }) => {
    const index = (progress[playerId]?.mine ?? 0) - 1
    return index >= 0 && !blastLog.some((blast) => blast.index === index)
      ? [{ index, atMs: raceMs }]
      : []
  })
  if (newBlasts.length > 0) setBlastLog([...blastLog, ...newBlasts])
  const newScans = others.flatMap(({ playerId }) => {
    const reported = progress[playerId]
    const count = reported?.scans ?? 0
    const seen = scanLog.filter((scan) => scan.playerId === playerId).length
    return reported !== undefined && count > seen
      ? [{ playerId, count, atMs: raceMs, x: (reported.scanX ?? 0) / 10, y: (reported.scanY ?? 0) / 10 }]
      : []
  })
  if (newScans.length > 0) setScanLog([...scanLog, ...newScans])

  /* ---------------- this player's own run ---------------- */

  const [inputs, setInputs] = useState<Input[]>([])
  const goneIndexes = useMemo(() => new Set(blastLog.map(({ index }) => index)), [blastLog])
  // The field as this player's run sees it: mines others have already set off are not there.
  const { liveMap, originalIndex } = useMemo(() => {
    const kept = map.mines.map((_, index) => index).filter((index) => !goneIndexes.has(index))
    return { liveMap: { ...map, mines: kept.map((index) => map.mines[index]!) }, originalIndex: kept }
  }, [map, goneIndexes])

  const [stoppedAtMs, setStoppedAtMs] = useState<number | null>(null)
  const outcome = simulateRun(liveMap, inputs, stoppedAtMs ?? raceMs)
  const isFinished = outcome.finishedAtMs !== null
  const isOut = outcome.eliminatedAtMs !== null
  const isTimeUp = raceMs >= MINEFIELD.MAX_RACE_MS
  const rivalFinishedId = others.find(({ playerId }) => progress[playerId]?.status === 1)?.playerId ?? null
  // Once someone has crossed the line the race is over: nothing more counts.
  const isRaceCalled = rivalFinishedId !== null || closingPlayerIds !== null || finalRanking !== null
  const isOver = isFinished || isOut || isTimeUp || isRaceCalled
  if (stoppedAtMs === null && isOver && raceMs > 0) setStoppedAtMs(raceMs)

  const addInput = useCallback(
    (build: (atMs: number) => Input) => {
      const atMs = Math.round(performance.now() - timingStartsAtLocalMs)
      if (atMs < 0 || atMs > MINEFIELD.MAX_RACE_MS) return
      setInputs((current) =>
        current.length >= MINEFIELD.MAX_INPUTS ? current : [...current, build(atMs)],
      )
    },
    [timingStartsAtLocalMs],
  )
  const lastScan = outcome.scans.at(-1)
  const sonarReadyAtMs = lastScan === undefined ? 0 : lastScan.atMs + MINEFIELD.SONAR_COOLDOWN_MS
  const onMove = useCallback(
    (dx: Axis, dy: Axis) => { addInput((atMs) => ({ kind: 'move', atMs, dx, dy })) },
    [addInput],
  )
  const onSonar = useCallback(() => {
    // Pressed while recharging does nothing, here as on the server, so it is not sent.
    if (performance.now() - timingStartsAtLocalMs < sonarReadyAtMs) return
    addInput((atMs) => ({ kind: 'sonar', atMs }))
  }, [addInput, sonarReadyAtMs, timingStartsAtLocalMs])
  useHeldKeys({ enabled: isPlaying && !isOver && !isSpectating, onMove, onSonar })

  // Everyone else watches this player's progress.
  const lastHit = outcome.detonations.at(-1)
  const report = {
      x: Math.min(MINEFIELD.WIDTH * 10, Math.round(outcome.x * 10)),
      lives: outcome.livesLeft,
      status: isFinished ? 1 : isOut ? 2 : 0,
      mine: lastHit === undefined ? 0 : originalIndex[lastHit.mineIndex]! + 1,
      scans: Math.min(MAX_SCANS, outcome.scans.length),
      scanX: lastScan === undefined ? 0 : Math.round(lastScan.x * 10),
      scanY: lastScan === undefined ? 0 : Math.round(lastScan.y * 10),
  }
  useThrottledReport(report, isPlaying && !isSpectating, onProgress)

  // Report once, the moment this player's race is over. The server replays the
  // inputs itself, so nothing here claims an outcome.
  useEffect(() => {
    if (submitted.current || isSpectating || !isPlaying || !isOver) return
    submitted.current = true
    onSubmit({ inputs, timingSuspect: tabWasHidden })
  }, [isSpectating, isPlaying, isOver, inputs, tabWasHidden, onSubmit])

  /* ---------------- the picture ---------------- */

  const winnerIds = ((): ReadonlySet<string> => {
    if (finalRanking !== null) {
      return new Set(
        finalRanking
          .filter((entry) => entry.rank === 1 && entry.detail.finished === true)
          .map((entry) => entry.playerId),
      )
    }
    const ids = others.filter(({ playerId }) => progress[playerId]?.status === 1).map(({ playerId }) => playerId)
    return new Set(isFinished ? [...ids, selfPlayerId] : ids)
  })()

  const ownScans: Scan[] = outcome.scans
  const allScans: Scan[] = [...ownScans, ...scanLog]
  const ownGone = outcome.detonations.map(({ mineIndex }) => originalIndex[mineIndex]!)
  const gone = new Set([...goneIndexes, ...ownGone])
  const revealed = revealedMines(map, allScans, raceMs, gone)

  const blasts: Blast[] = [
    ...outcome.detonations.map(({ atMs, mineIndex }) => {
      const mine = liveMap.mines[mineIndex]!
      return { x: mine.x, y: mine.y, atMs }
    }),
    ...blastLog.flatMap(({ index, atMs }) => {
      const mine = map.mines[index]
      return mine === undefined ? [] : [{ x: mine.x, y: mine.y, atMs }]
    }),
  ]

  const selfPlayer = players.find(({ playerId }) => playerId === selfPlayerId)
  const racers: Racer[] = players.map((player, index) => {
    if (player.playerId === selfPlayerId) {
      const isHeld = raceMs < (outcome.scans.at(-1)?.atMs ?? -Infinity) + MINEFIELD.SONAR_ANIMATION_MS
      const lastBlastAt = outcome.detonations.at(-1)?.atMs ?? -Infinity
      return {
        playerId: player.playerId,
        x: outcome.x,
        y: outcome.y,
        isSelf: true,
        state: winnerIds.has(player.playerId)
          ? 'won'
          : isOut
            ? 'out'
            : raceMs < lastBlastAt + MINEFIELD.EXPLOSION_ANIMATION_MS
              ? 'exploding'
              : isHeld
                ? 'scanning'
                : 'racing',
        isProtected: raceMs < lastBlastAt + MINEFIELD.INVULNERABLE_MS,
        lives: outcome.livesLeft,
      }
    }
    const reported = progress[player.playerId]
    const rivalIndex = others.findIndex(({ playerId }) => playerId === player.playerId)
    // Rivals report how far they are, not how far across: spread them over the width.
    const lane = others.length > 1 ? 1.5 + (rivalIndex / (others.length - 1)) * (map.height - 3) : 3
    void index
    return {
      playerId: player.playerId,
      x: (reported?.x ?? map.startX * 10) / 10,
      y: lane,
      isSelf: false,
      state: winnerIds.has(player.playerId) ? 'won' : reported?.status === 2 ? 'out' : 'racing',
      isProtected: false,
      lives: reported?.lives ?? MINEFIELD.LIVES,
    }
  })
  const frame: FieldFrame = {
    map,
    racers,
    revealed,
    gone: [...gone],
    blasts,
    scans: allScans,
    isRaceOver: isRaceCalled || finalRanking !== null,
  }

  const message = describe({
    players,
    selfPlayerId,
    isSpectating,
    isOut,
    isFinished,
    isTimeUp,
    rivalFinishedId,
    finalRanking,
  })
  const sonarFill = Math.min(1, Math.max(0, 1 - (sonarReadyAtMs - raceMs) / MINEFIELD.SONAR_COOLDOWN_MS))

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#7fb069' }}>
      <MinefieldStage
        map={map}
        players={players}
        selfPlayerId={selfPlayerId}
        timingStartsAtLocalMs={timingStartsAtLocalMs}
        frame={frame}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '22px 24px 26px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...sharedStyles.microLabel, color: color.ink }}>LIVES</div>
              <div style={{ display: 'flex', gap: 4, fontSize: 32, lineHeight: 1 }}>
                {Array.from({ length: MINEFIELD.LIVES }, (_, index) => (
                  <span
                    key={index}
                    style={{
                      color: index < outcome.livesLeft ? '#FF5FA2' : 'rgba(46,42,69,0.35)',
                      textShadow: `0 2px 0 ${color.ink}`,
                    }}
                  >
                    ♥
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...sharedStyles.microLabel, color: color.ink }}>TIME</div>
              <div
                style={{
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: 34,
                  lineHeight: 1,
                  color: MINEFIELD.MAX_RACE_MS - raceMs < 10_000 ? color.pink : color.cream,
                  textShadow: `0 2px 0 ${color.ink}`,
                }}
              >
                {formatClock(MINEFIELD.MAX_RACE_MS - raceMs)}
              </div>
            </div>
          </div>
          <RaceStrip racers={racers} players={players} finishX={map.finishX} width={map.width} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {message !== null && (
            <div
              key={message}
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 30,
                color: isOut ? '#FF7A72' : color.cream,
                textShadow: `0 3px 0 ${color.ink}`,
                animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
                textAlign: 'center',
              }}
            >
              {message}
            </div>
          )}
          {!isSpectating && selfPlayer !== undefined && (
            <>
              <div style={{ ...sharedStyles.microLabel, color: color.ink, opacity: isOut ? 0.4 : 0.9 }}>
                MOVE · ARROWS / WASD &nbsp;&nbsp; SONAR · SPACE
              </div>
              {/* Fills as the sonar recharges. */}
              <div
                style={{
                  width: 240,
                  maxWidth: '70%',
                  height: 7,
                  borderRadius: 4,
                  background: 'rgba(46, 42, 69, 0.35)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${sonarFill * 100}%`,
                    background: sonarFill >= 1 ? '#3fb8e0' : color.mutedSoft,
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Where everyone is along the whole field, in one thin strip. */
function RaceStrip({
  racers,
  players,
  finishX,
  width,
}: {
  racers: readonly Racer[]
  players: GameSurfaceProps['players']
  finishX: number
  width: number
}) {
  return (
    <div style={{ position: 'relative', height: 30, margin: '0 8px' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 12,
          height: 6,
          borderRadius: 3,
          background: 'rgba(46, 42, 69, 0.45)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${(finishX / width) * 100}%`,
          top: 4,
          width: 4,
          height: 22,
          background: color.cream,
          border: `1px solid ${color.ink}`,
        }}
      />
      {racers.flatMap((racer) => {
        const player = players.find(({ playerId }) => playerId === racer.playerId)
        return player === undefined ? [] : [{ racer, player }]
      }).map(({ racer, player }) => (
        <div
          key={racer.playerId}
          style={{
            position: 'absolute',
            left: `${Math.min(100, (racer.x / width) * 100)}%`,
            top: racer.isSelf ? 2 : 5,
            width: racer.isSelf ? 26 : 20,
            height: racer.isSelf ? 26 : 20,
            marginLeft: racer.isSelf ? -13 : -10,
            borderRadius: '50%',
            background: player.color,
            border: `2px solid ${racer.isSelf ? '#fff' : color.ink}`,
            opacity: racer.state === 'out' ? 0.4 : 1,
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: racer.isSelf ? 13 : 11,
            lineHeight: racer.isSelf ? '22px' : '16px',
            textAlign: 'center',
            color: color.ink,
            zIndex: racer.isSelf ? 2 : 1,
          }}
        >
          {racer.state === 'out' ? '☠' : player.initial}
        </div>
      ))}
    </div>
  )
}

function describe({
  players,
  selfPlayerId,
  isSpectating,
  isOut,
  isFinished,
  isTimeUp,
  rivalFinishedId,
  finalRanking,
}: {
  players: GameSurfaceProps['players']
  selfPlayerId: string
  isSpectating: boolean
  isOut: boolean
  isFinished: boolean
  isTimeUp: boolean
  rivalFinishedId: string | null
  finalRanking: GameSurfaceProps['finalRanking']
}): string | null {
  const nameOf = (playerId: string) => players.find((player) => player.playerId === playerId)?.name ?? 'Someone'
  if (finalRanking !== null) {
    const winners = finalRanking.filter((entry) => entry.rank === 1)
    const [winner] = winners
    if (winners.length !== 1 || winner === undefined) return 'Dead heat! Sudden death next…'
    const crossed = winner.detail.finished === true
    if (winner.playerId === selfPlayerId) return crossed ? 'You crossed first!' : 'You got furthest!'
    return crossed ? `${nameOf(winner.playerId)} crossed first!` : `${nameOf(winner.playerId)} got furthest!`
  }
  if (isFinished) return 'You crossed first!'
  if (rivalFinishedId !== null) return `${nameOf(rivalFinishedId)} crossed the line!`
  if (isSpectating) return 'Watching from the sidelines'
  if (isOut) return 'Blown up! Watching the rest…'
  if (isTimeUp) return 'Time! Locking in…'
  return null
}
