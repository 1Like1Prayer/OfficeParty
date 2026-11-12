import { useEffect, useRef } from 'react'
import type { MinefieldMap } from '../../shared/games/minefield/types.ts'
import type { RoundPlayerView } from '../../types/index.ts'
import { tileScaleFor, type FieldFrame } from './fieldFrame.ts'
import { MinefieldScene } from './scene/MinefieldScene.ts'

interface MinefieldStageProps {
  map: MinefieldMap
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  timingStartsAtLocalMs: number
  frame: FieldFrame
}

/**
 * Hosts the three.js field. One scene lives as long as the round does; it is
 * told who is racing when that changes and handed the latest state on every render.
 */
export function MinefieldStage({ map, players, selfPlayerId, timingStartsAtLocalMs, frame }: MinefieldStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<MinefieldScene | null>(null)
  const playerKey = players.map(({ playerId }) => playerId).join('|')
  const tileScale = tileScaleFor(players.length)

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const scene = new MinefieldScene(host, { map, timingStartsAtLocalMs, selfPlayerId, tileScale })
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [map, timingStartsAtLocalMs, selfPlayerId, tileScale])

  // Declared after the scene's own effect, so on mount the scene exists by now.
  useEffect(() => {
    sceneRef.current?.setRoster(players)
    // Keyed on the ids and order, not on the array, which is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey, map, timingStartsAtLocalMs, selfPlayerId, tileScale])

  useEffect(() => {
    sceneRef.current?.setFrame(frame)
  })

  return (
    <div
      ref={hostRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#a9dbf5' }}
    />
  )
}
