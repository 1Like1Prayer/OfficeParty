import { useEffect, useRef } from 'react'
import type { RoundPlayerView } from '../../../types/index.ts'
import { ArenaScene } from './ArenaScene.ts'
import type { LaneView } from './types.ts'

interface EscalatorArenaProps {
  players: readonly RoundPlayerView[]
  lanes: readonly LaneView[]
  /** The escalators run and the runners climb. */
  isRacing: boolean
  /** Play the opening animation when the lanes first appear, rather than showing them at once. */
  introduce: boolean
}

/**
 * Hosts the three.js arena. There is one scene for the life of the component;
 * it is told who is on the escalators when that changes, and handed the newest
 * lanes on every render.
 */
export function EscalatorArena({ players, lanes, isRacing, introduce }: EscalatorArenaProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<ArenaScene | null>(null)
  const playerKey = players.map(({ playerId }) => playerId).join('|')

  // One scene for as long as this is mounted, so a change of roster — the
  // finalists replacing the heats — can be played as a changeover in it.
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const scene = new ArenaScene(host)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  // Told again only when who is playing, or their order, changes.
  useEffect(() => {
    // `introduce` only matters for the first roster; later changes play the changeover.
    sceneRef.current?.setRoster(players, { introduce })
    // Keyed on the ids and order, not on the array, which is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey])

  useEffect(() => {
    sceneRef.current?.setLanes(lanes, isRacing)
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
