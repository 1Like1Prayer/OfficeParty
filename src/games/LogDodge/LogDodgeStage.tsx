import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { Action, Log } from '../../shared/games/logDodge/types.ts'
import type { RoundPlayerView } from '../../types/index.ts'
import { LogDodgeScene, type StageStatus } from './scene/LogDodgeScene.ts'

export interface LogDodgeStageHandle {
  /** The player pressed a move, `atMs` into the round. */
  press: (action: Action, atMs: number) => void
}

interface LogDodgeStageProps {
  ref?: Ref<LogDodgeStageHandle>
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  logs: readonly Log[]
  timingStartsAtLocalMs: number
  status: StageStatus
}

/**
 * Hosts the three.js stage. There is one scene for as long as this is
 * mounted; it is told who is running when that changes, and handed the latest
 * standings on every render.
 */
export function LogDodgeStage({
  ref,
  players,
  selfPlayerId,
  logs,
  timingStartsAtLocalMs,
  status,
}: LogDodgeStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<LogDodgeScene | null>(null)
  const playerKey = players.map(({ playerId }) => playerId).join('|')

  useImperativeHandle(ref, () => ({
    press: (action, atMs) => { sceneRef.current?.press(action, atMs) },
  }), [])

  // A new schedule or a new start time is a new round, so it gets a new scene.
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const scene = new LogDodgeScene(host, { logs, timingStartsAtLocalMs, selfPlayerId })
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [logs, timingStartsAtLocalMs, selfPlayerId])

  // Declared after the scene's own effect, so on mount the scene exists by now.
  useEffect(() => {
    sceneRef.current?.setRoster(players)
    // Keyed on the ids and order, not on the array, which is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey])

  useEffect(() => {
    sceneRef.current?.setStatus(status)
  })

  return (
    <div
      ref={hostRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#0a051c',
      }}
    />
  )
}
