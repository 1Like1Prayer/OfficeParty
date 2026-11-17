import { useEffect, useRef } from 'react'
import type { RoundPlayerView } from '../../../types/index.ts'
import { ArenaScene, type RosterChange } from './ArenaScene.ts'
import type { LaneView } from './types.ts'

interface EscalatorArenaProps {
  /** Who has a lane on screen, in lane order. */
  players: readonly RoundPlayerView[]
  /** Every runner's state, on screen or not: one leaving the screen still has to be told it fell. */
  lanes: readonly LaneView[]
  /** Changes with each fresh attempt (a tiebreaker), whose new line-up gets the full changeover. */
  attemptKey: string
  /** The escalators run and the runners climb. */
  isRacing: boolean
  /** `performance.now()` value the round's clock starts at, for the camera's opening swoop. */
  timingStartsAtLocalMs: number
  /** How many lanes the camera closes in on: the player and their neighbours. */
  focusLaneCount: number
}

/**
 * Hosts the three.js arena. There is one scene for the life of the component;
 * it is told who is on the escalators when that changes, and handed the newest
 * lanes on every render. Everyone still racing has a lane; the camera opens
 * over them all and closes in on the player and their neighbours.
 */
export function EscalatorArena({
  players,
  lanes,
  attemptKey,
  isRacing,
  timingStartsAtLocalMs,
  focusLaneCount,
}: EscalatorArenaProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<ArenaScene | null>(null)
  const rosterAttemptKey = useRef(attemptKey)
  const playerKey = players.map(({ playerId }) => playerId).join('|')

  // One scene for as long as this is mounted, so a change of roster — a
  // tiebreaker among some of the runners — can be played as a changeover in it.
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

  useEffect(() => {
    sceneRef.current?.setView(timingStartsAtLocalMs, focusLaneCount)
  }, [timingStartsAtLocalMs, focusLaneCount])

  // Told again only when who is on screen, or their order, changes.
  useEffect(() => {
    // A fresh attempt's line-up plays the full changeover; within one, runners
    // swallowed or coming into view just close up (the first roster builds the scene).
    const change: RosterChange = rosterAttemptKey.current === attemptKey ? 'reflow' : 'changeover'
    rosterAttemptKey.current = attemptKey
    // The latest states first, so a lane leaving because its runner was swallowed sees them fall.
    sceneRef.current?.setLanes(lanes, isRacing)
    sceneRef.current?.setRoster(players, change)
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
