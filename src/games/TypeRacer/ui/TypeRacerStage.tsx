import { useEffect, useRef } from 'react'
import type { RoundPlayerView } from '../../../types/index.ts'
import { TypeRacerScene } from '../scene/TypeRacerScene.ts'

interface TypeRacerStageProps {
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  /** Join mid-race: skip the showcase and go straight to the player. */
  skipShowcase: boolean
  /** An element above the rest of the screen, for the dice roll to be drawn in. */
  frontHost: HTMLElement | null
  /** Called with the scene once it exists, and with null when it is torn down. */
  onScene: (scene: TypeRacerScene | null) => void
}

/**
 * Hosts the three.js stage. One scene for as long as it is mounted; the
 * parent drives it through the scene it is handed.
 */
export function TypeRacerStage({ players, selfPlayerId, skipShowcase, frontHost, onScene }: TypeRacerStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerKey = players.map(({ playerId }) => playerId).join('|')

  useEffect(() => {
    const host = hostRef.current
    if (host === null || frontHost === null) return
    const scene = new TypeRacerScene(host)
    scene.attachFrontLayer(frontHost)
    scene.setRoster(players, selfPlayerId)
    scene.startShowcase(skipShowcase)
    onScene(scene)
    return () => {
      onScene(null)
      scene.dispose()
    }
    // Rebuilt only when who is playing changes; the scene is not meant to restart for anything else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey, selfPlayerId, frontHost])

  return (
    <div
      ref={hostRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#1a1740' }}
    />
  )
}
