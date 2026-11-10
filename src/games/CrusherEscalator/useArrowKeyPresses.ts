import { useEffect } from 'react'
import type { Direction } from '../../shared/games/crusherEscalator/types.ts'
import { directionForKey } from './controls.ts'

/**
 * Calls `onPress` for each arrow (or WASD) key press while `enabled`. Holding a
 * key down does not repeat: every point has to be a deliberate press.
 */
export function useArrowKeyPresses(
  enabled: boolean,
  onPress: (direction: Direction) => void,
): void {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      const direction = directionForKey(event.key)
      if (direction === null) return
      // Arrow keys would otherwise scroll the page.
      event.preventDefault()
      if (!event.repeat) onPress(direction)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [enabled, onPress])
}
