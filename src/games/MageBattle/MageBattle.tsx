import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '../../hooks/index.ts'
import { useTabWasHidden } from '../../hooks/useTabWasHidden.ts'
import { MAGE_BATTLE } from '../../shared/games/mageBattle/constants.ts'
import { startDial } from '../../shared/games/mageBattle/dial.ts'
import { readDial } from '../../shared/games/mageBattle/module.ts'
import { battleBar } from '../../shared/games/mageBattle/progress.ts'
import type { Dial, MageBattleRound } from '../../shared/games/mageBattle/types.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import type { GameSurfaceProps } from '../types.ts'
import { MageBattleGame, type SpellEvent } from './MageBattleGame.ts'
import { BattleBar } from './ui/BattleBar.tsx'
import { BLOCK_COLORS } from './ui/drawDial.ts'

const isRound = (data: unknown): data is MageBattleRound =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as MageBattleRound).seed === 'number' &&
  Array.isArray((data as MageBattleRound).playerIds)

/** How long a "+3" or "MISS" stays up. */
const CALLOUT_MS = 900

/**
 * Mage Battle. The mages stand in a circle and pour their beams into the
 * middle. Each spin of the dial, press once while the needle is over a block
 * to score it; fall seven points behind the leader and you are knocked out.
 *
 * The opening: the camera circles the arena from beyond its stones, as each
 * mage charges a spell and fires their beam; then it circles round behind
 * this player's mage while the start is counted in, and the dial comes up. This component is the bridge between the round and the game,
 * which runs outside React on its own frame loop (MageBattleGame).
 */
export function MageBattle(props: GameSurfaceProps) {
  const round = isRound(props.data) ? props.data : null
  if (round === null) return null
  return <MageBattleRun key={props.attemptKey} {...props} round={round} />
}

function MageBattleRun({
  phase,
  round,
  players,
  selfPlayerId,
  shared,
  closingPlayerIds,
  finalRanking,
  timingStartsAtLocalMs,
  onSubmit,
  onAction,
}: GameSurfaceProps & { round: MageBattleRound }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const dialRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<MageBattleGame | null>(null)
  const isFighting = players.some(({ playerId }) => playerId === selfPlayerId)
  const isPlaying = phase === 'playing'
  const tabWasHidden = useTabWasHidden(isPlaying)
  const [dial, setDial] = useState<Dial>(() => startDial(round.seed, selfPlayerId))
  const [isDone, setIsDone] = useState(false)
  const [callout, setCallout] = useState<{ event: SpellEvent; key: number } | null>(null)

  // The game calls back long after this render; it always reaches the latest props.
  const latest = useRef({ onSubmit, onAction, tabWasHidden })
  useEffect(() => {
    latest.current = { onSubmit, onAction, tabWasHidden }
  })

  const playerKey = players.map(({ playerId }) => playerId).join('|')
  useEffect(() => {
    const host = hostRef.current
    const dialCanvas = dialRef.current
    if (host === null || dialCanvas === null) return
    const game = new MageBattleGame(
      { host, dialCanvas, round, players, selfPlayerId, isFighting, timingStartsAtLocalMs },
      {
        press: (atMs) => latest.current.onAction({ type: 'press', atMs }),
        dial: setDial,
        spell: (event) => { setCallout({ event, key: performance.now() }) },
        finish: () => {
          setIsDone(true)
          latest.current.onSubmit({ timingSuspect: latest.current.tabWasHidden })
        },
      },
    )
    gameRef.current = game
    return () => {
      game.dispose()
      gameRef.current = null
    }
    // The roster is keyed on its ids, not the array, which is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey, selfPlayerId, isFighting, round, timingStartsAtLocalMs])

  useEffect(() => { gameRef.current?.setStage(phase) }, [phase])
  useEffect(() => { gameRef.current?.setShared(shared) }, [shared])

  const isToldToStop = closingPlayerIds?.includes(selfPlayerId) ?? false
  useEffect(() => {
    if (isToldToStop) gameRef.current?.stop()
  }, [isToldToStop])

  const winnerIds = (finalRanking ?? []).filter((entry) => entry.rank === 1).map((entry) => entry.playerId)
  const winnerKey = winnerIds.join('|')
  useEffect(() => {
    gameRef.current?.setWinners(new Set(winnerKey === '' ? [] : winnerKey.split('|')))
  }, [winnerKey])

  useEffect(() => {
    if (callout === null) return
    const timer = setTimeout(() => { setCallout(null) }, CALLOUT_MS)
    return () => { clearTimeout(timer) }
  }, [callout])

  const secondsLeft = useSecondsLeft(timingStartsAtLocalMs, isPlaying && finalRanking === null)

  /* ---------------- the HUD ---------------- */

  const isTouch = useMediaQuery('(pointer: coarse)')
  const world = { get: (key: string) => shared[key] }
  const bar = battleBar(
    round.playerIds.map((playerId) => {
      const theirs = playerId === selfPlayerId && isFighting ? dial : readDial(world, round, playerId)
      return { playerId, score: theirs.score, out: theirs.outAtMs !== null }
    }),
  )
  const you = bar.markers.find(({ playerId }) => playerId === selfPlayerId)
  const isOut = you?.out ?? false
  const showDial = isFighting && phase !== 'building' && !isOut && finalRanking === null
  const nameOf = (playerId: string) => players.find((player) => player.playerId === playerId)?.name ?? 'Someone'

  const message = ((): string | null => {
    if (finalRanking !== null) {
      if (winnerIds.length !== 1) return 'A draw! Another duel…'
      return winnerIds[0] === selfPlayerId ? 'You are the last mage standing!' : `${nameOf(winnerIds[0]!)} wins the duel!`
    }
    if (!isFighting) return 'Watching the duel'
    if (isOut) return 'Knocked out! Watching the rest…'
    if (isDone) return 'Time! Counting the scores…'
    if (phase === 'building') return 'Mages, take your places'
    return null
  })()

  const standing = ((): string | null => {
    if (you === undefined || you.out || !isPlaying || finalRanking !== null) return null
    if (you.margin > 0) return `Leading by ${you.margin}`
    if (you.margin === 0) return 'Level for the lead'
    return `${you.behindLeader} behind · out at ${MAGE_BATTLE.ELIMINATION_GAP}`
  })()

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', background: '#2E2A45', touchAction: 'manipulation' }}
      onPointerDown={() => { gameRef.current?.press() }}
    >
      <div ref={hostRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />

      {/* The dial, in the middle of the screen with the clash showing through it. */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'relative',
            width: 'min(54vmin, 400px)',
            aspectRatio: '1',
            opacity: showDial ? 1 : 0,
            transform: showDial ? 'scale(1)' : 'scale(0.6)',
            // Comes up once the camera has landed behind the mage (its flight takes 2.2s); goes at once.
            transition: showDial
              ? 'opacity 500ms ease-out 1700ms, transform 700ms cubic-bezier(.34,1.56,.64,1) 1700ms'
              : 'opacity 300ms ease-in, transform 300ms ease-in',
          }}
        >
          <canvas ref={dialRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {callout !== null && <Callout key={callout.key} event={callout.event} />}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: isTouch
            ? 'max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))'
            : 'clamp(10px, 2.4vh, 20px) clamp(14px, 3vw, 24px) clamp(14px, 3vh, 26px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, maxWidth: 760, margin: '0 auto', opacity: phase === 'building' ? 0 : 1, transition: 'opacity 600ms' }}>
            <BattleBar bar={bar} players={players} selfPlayerId={selfPlayerId} isCompact={isTouch} />
          </div>
          <div style={{ textAlign: 'right', minWidth: 56, visibility: finalRanking === null && !isDone ? 'visible' : 'hidden' }}>
            <div style={{ ...sharedStyles.microLabel, color: color.cream }}>TIME</div>
            <div
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 'clamp(24px, 4.8vmin, 34px)',
                lineHeight: 1,
                color: secondsLeft !== null && secondsLeft <= 10 ? '#FF7A72' : color.cream,
                textShadow: `0 2px 0 ${color.ink}`,
              }}
            >
              {secondsLeft ?? Math.round(MAGE_BATTLE.ROUND_MS / 1000)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {message !== null && (
            <div
              key={message}
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 'clamp(20px, 5vmin, 30px)',
                color: isOut && finalRanking === null ? '#FF7A72' : color.cream,
                textShadow: `0 3px 0 ${color.ink}`,
                animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
                textAlign: 'center',
              }}
            >
              {message}
            </div>
          )}
          {standing !== null && (
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 'clamp(16px, 3.6vmin, 22px)', color: color.cream, textShadow: `0 2px 0 ${color.ink}` }}>
              {standing}
            </div>
          )}
          {isFighting && !isOut && finalRanking === null && phase !== 'building' && (
            <div style={{ ...sharedStyles.microLabel, color: color.cream, opacity: isDone ? 0.4 : 0.9, textAlign: 'center' }}>
              {isTouch ? 'TAP' : 'SPACE / CLICK'} WHEN THE NEEDLE IS ON A BLOCK · ONE PRESS PER SPIN
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** "+3", "MISS", and friends, popping up inside the dial. */
function Callout({ event }: { event: SpellEvent }) {
  const [text, tone] = ((): [string, string] => {
    switch (event.kind) {
      case 'hit':
        return [`+${event.points}`, BLOCK_COLORS[event.points] ?? color.cream]
      case 'miss':
        return ['MISS', '#FF7A72']
      case 'idle':
        return ['TOO SLOW', '#FF7A72']
      case 'spent':
        return ['NEXT SPIN', color.cream]
    }
  })()
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: event.kind === 'hit' ? 'clamp(40px, 11vmin, 72px)' : 'clamp(24px, 6vmin, 40px)',
        color: tone,
        textShadow: `0 3px 0 ${color.ink}, 0 0 18px rgba(0,0,0,.45)`,
        animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  )
}

/** Whole seconds left on the round clock while `running`, or null. */
function useSecondsLeft(timingStartsAtLocalMs: number, running: boolean): number | null {
  const compute = () => Math.max(0, Math.ceil((MAGE_BATTLE.ROUND_MS - (performance.now() - timingStartsAtLocalMs)) / 1000))
  const [seconds, setSeconds] = useState<number | null>(null)
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => { setSeconds(compute()) }, 200)
    return () => { clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, timingStartsAtLocalMs])
  return running ? seconds : null
}
