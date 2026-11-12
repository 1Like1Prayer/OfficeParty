import { useEffect, useRef, type RefObject } from 'react'
import { skullsForRoll } from '../../../shared/games/typeRacer/dice.ts'
import type { TypeRacerScene } from '../scene/TypeRacerScene.ts'
import type { RaceState } from './raceState.ts'

/**
 * Plays the player's own race on the stage as it happens: each correct key
 * works the typewriter, each wrong one jams it, a finished line rings the
 * carriage, three strikes put the board under strain, the dice are thrown when
 * the server answers, and the end — finished or out — is acted out.
 *
 * It reacts to changes in the race, so each thing happens once.
 */
export function useSceneSync(sceneRef: RefObject<TypeRacerScene | null>, state: RaceState): void {
  const previous = useRef(state)

  useEffect(() => {
    const scene = sceneRef.current
    const before = previous.current
    previous.current = state
    if (scene === null) return

    // A burst of keys between two renders still works the typewriter that many times.
    for (let key = 0; key < Math.min(3, state.correctKeys - before.correctKeys); key++) scene.keyPress()
    if (state.mistakeCount > before.mistakeCount) scene.mistake()
    if (state.linesDoneCount > before.linesDoneCount) scene.lineDone()
    if (state.paragraphIndex > before.paragraphIndex) scene.newParagraph()

    // Three strikes: pick the die up and shake it now; it is thrown when the server answers.
    if (state.status === 'rolling' && before.status !== 'rolling') scene.beginRoll(skullsForRoll(state.rollsCast))
    if (state.status === 'rolling') scene.setSelfStress(1)
    else if (state.status === 'typing') scene.setSelfStress(state.strikes >= 2 ? 0.4 : 0)

    if (state.pendingRoll !== null && before.pendingRoll === null) scene.rollDie(state.pendingRoll)

    const wonNow = state.status === 'finished' || state.status === 'survived'
    const hadWon = before.status === 'finished' || before.status === 'survived'
    if (wonNow && !hadWon) scene.celebrate()
    if (state.status === 'out' && before.status !== 'out') {
      // Time can run out while the die is still shaking, waiting on the server.
      // Nothing will ever throw it then, so it must not be left spinning.
      if (state.cause === 'time') scene.cancelRoll()
      scene.crumble()
    }
  }, [sceneRef, state])
}
