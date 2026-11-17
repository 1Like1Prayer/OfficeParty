import { useEffect, useRef, useState } from 'react'
import { useTabWasHidden } from '../../hooks/useTabWasHidden.ts'
import type { HexDropRound } from '../../shared/games/hexDrop/types.ts'
import { useMediaQuery } from '../../hooks/index.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import { ActionButton } from '../touch/ActionButton.tsx'
import { Joystick } from '../touch/Joystick.tsx'
import { TouchBar } from '../touch/TouchBar.tsx'
import type { GameSurfaceProps } from '../types.ts'
import { HexDropGame } from './HexDropGame.ts'

const isRound = (data: unknown): data is HexDropRound =>
  typeof data === 'object' && data !== null && typeof (data as HexDropRound).spawns === 'object'

/**
 * Hex Drop. Everyone starts on the top layer of a stack of hexagonal tiles; a
 * tile drops two seconds after someone first stands on it. Fall through
 * every layer and you are out. Last one up wins.
 *
 * This component is the bridge between the round and the game: the game
 * itself (HexDropGame) runs outside React, on its own frame loop, and is
 * handed what the room says as it changes.
 */
export function HexDrop(props: GameSurfaceProps) {
  const round = isRound(props.data) ? props.data : null
  if (round === null) return null
  return <HexDropRun key={props.attemptKey} {...props} round={round} />
}

function HexDropRun({
  phase,
  round,
  players,
  selfPlayerId,
  progress,
  shared,
  closingPlayerIds,
  finalRanking,
  timingStartsAtLocalMs,
  onSubmit,
  onProgress,
  onAction,
}: GameSurfaceProps & { round: HexDropRound }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<HexDropGame | null>(null)
  const isRunning = players.some(({ playerId }) => playerId === selfPlayerId)
  const isPlaying = phase === 'playing'
  const tabWasHidden = useTabWasHidden(isPlaying)
  const [outcome, setOutcome] = useState<{ outAtMs: number | null } | null>(null)

  // The game calls back long after this render; it always reaches the latest props.
  const latest = useRef({ onSubmit, onProgress, onAction, tabWasHidden })
  useEffect(() => {
    latest.current = { onSubmit, onProgress, onAction, tabWasHidden }
  })

  const playerKey = players.map(({ playerId }) => playerId).join('|')
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const game = new HexDropGame(
      { host, players, selfPlayerId, isRunning, spawns: round.spawns, timingStartsAtLocalMs },
      {
        touch: (tile, atMs) => latest.current.onAction({ type: 'touch', tile, atMs }),
        progress: (sample) => { latest.current.onProgress(sample) },
        finish: (outAtMs) => {
          setOutcome({ outAtMs })
          latest.current.onSubmit({ outAtMs, timingSuspect: latest.current.tabWasHidden })
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
  }, [playerKey, selfPlayerId, isRunning, round, timingStartsAtLocalMs])

  useEffect(() => { gameRef.current?.setShared(shared) }, [shared])
  useEffect(() => { gameRef.current?.setProgress(progress) }, [progress])

  // The server has called the round while this runner is still up: they are the last one.
  const isToldToStop = closingPlayerIds?.includes(selfPlayerId) ?? false
  useEffect(() => {
    if (isToldToStop) gameRef.current?.stop()
  }, [isToldToStop])

  const winnerIds = (finalRanking ?? [])
    .filter((entry) => entry.rank === 1)
    .map((entry) => entry.playerId)
  const winnerKey = winnerIds.join('|')
  useEffect(() => {
    gameRef.current?.setWinners(new Set(winnerKey === '' ? [] : winnerKey.split('|')))
  }, [winnerKey])

  /* ---------------- the HUD ---------------- */

  // A finger rather than a keyboard: a stick and a jump button take the keys' place.
  const isTouch = useMediaQuery('(pointer: coarse)')
  const canControl = isRunning && isPlaying && outcome === null

  const isOut = (playerId: string) =>
    playerId === selfPlayerId ? outcome !== null && outcome.outAtMs !== null : progress[playerId]?.out === 1
  const stillUp = players.filter(({ playerId }) => !isOut(playerId)).length
  const nameOf = (playerId: string) =>
    players.find((player) => player.playerId === playerId)?.name ?? 'Someone'

  const message = ((): string | null => {
    if (finalRanking !== null) {
      if (winnerIds.length !== 1) return 'Dead heat! Sudden death next…'
      return winnerIds[0] === selfPlayerId ? 'Last one standing — you win!' : `${nameOf(winnerIds[0]!)} is the last one standing!`
    }
    if (!isRunning) return 'Watching from above'
    if (outcome?.outAtMs !== null && outcome !== null) return 'You fell! Watching the rest…'
    if (outcome !== null) return 'Last one standing!'
    if (!isPlaying) return 'A tile drops 2 seconds after it is stood on'
    return null
  })()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#2E2A45' }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          // Tighter on a phone, clear of the notch; there the controls own the bottom corners.
          padding: isTouch
            ? 'max(12px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 0 max(14px, env(safe-area-inset-left))'
            : 'clamp(12px, 3vh, 22px) clamp(14px, 3vw, 24px) clamp(14px, 3vh, 26px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...sharedStyles.microLabel, color: color.cream }}>STILL UP</div>
            <div
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 'clamp(24px, 4.8vmin, 34px)',
                lineHeight: 1,
                color: color.cream,
                textShadow: `0 2px 0 ${color.ink}`,
              }}
            >
              {stillUp}/{players.length}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            // Above the stick and jump button on a phone, not squeezed between them.
            paddingBottom: isTouch && isRunning ? 'calc(156px + env(safe-area-inset-bottom))' : 0,
          }}
        >
          {message !== null && (
            <div
              key={message}
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 'clamp(20px, 5vmin, 30px)',
                color: isOut(selfPlayerId) && finalRanking === null ? '#FF7A72' : color.cream,
                textShadow: `0 3px 0 ${color.ink}`,
                animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
                textAlign: 'center',
              }}
            >
              {message}
            </div>
          )}
          {isRunning && !isTouch && (
            <div style={{ ...sharedStyles.microLabel, color: color.cream, opacity: outcome === null ? 0.9 : 0.4 }}>
              MOVE · ARROWS / WASD &nbsp;&nbsp; JUMP · SPACE
            </div>
          )}
        </div>
      </div>

      {isTouch && isRunning && (
        <TouchBar
          enabled={canControl}
          stick={<Joystick enabled={canControl} onChange={({ x, y }) => { gameRef.current?.setStick(x, y) }} />}
          action={<ActionButton label="Jump" enabled={canControl} onPress={() => { gameRef.current?.pressJump() }} tone={color.pink} />}
        />
      )}
    </div>
  )
}
