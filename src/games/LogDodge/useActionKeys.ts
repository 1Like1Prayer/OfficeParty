import { useEffect } from 'react'
import type { Action } from '../../shared/games/logDodge/types.ts'
import { actionForKey } from './controls.ts'

/**
 * Calls `onPress` for each jump, split or duck key press while `enabled`.
 * Holding a key down does not repeat: every move has to be a deliberate press.
 */
export function useActionKeys(enabled: boolean, onPress: (action: Action) => void): void {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const action = actionForKey(event.key)
      if (action === null) return
      // The arrows and space would otherwise scroll the page.
      event.preventDefault()
      if (!event.repeat) onPress(action)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [enabled, onPress])
}
