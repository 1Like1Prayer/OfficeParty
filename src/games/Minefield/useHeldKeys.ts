import { useEffect, useRef } from 'react'
import type { Axis } from '../../shared/games/minefield/types.ts'

const LEFT = new Set(['ArrowLeft', 'a', 'A'])
const RIGHT = new Set(['ArrowRight', 'd', 'D'])
const UP = new Set(['ArrowUp', 'w', 'W'])
const DOWN = new Set(['ArrowDown', 's', 'S'])

const axisOf = (negative: boolean, positive: boolean): Axis =>
  negative === positive ? 0 : negative ? -1 : 1

/**
 * Reports the direction the keys currently held point in, whenever it changes
 * (all keys released is 0, 0), and each press of the sonar key. Releasing the
 * window's focus lets go of everything, so the runner never keeps walking on a
 * key the page did not see come up.
 */
export function useHeldKeys({
  enabled,
  onMove,
  onSonar,
}: {
  enabled: boolean
  onMove: (dx: Axis, dy: Axis) => void
  onSonar: () => void
}): void {
  const handlers = useRef({ onMove, onSonar })
  useEffect(() => {
    handlers.current = { onMove, onSonar }
  })

  useEffect(() => {
    if (!enabled) return
    const held = new Set<string>()
    let current = { dx: 0 as Axis, dy: 0 as Axis }

    const publish = () => {
      const has = (keys: Set<string>) => [...held].some((key) => keys.has(key))
      const next = { dx: axisOf(has(LEFT), has(RIGHT)), dy: axisOf(has(UP), has(DOWN)) }
      if (next.dx === current.dx && next.dy === current.dy) return
      current = next
      handlers.current.onMove(next.dx, next.dy)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === ' ') {
        event.preventDefault()
        if (!event.repeat) handlers.current.onSonar()
        return
      }
      if (![LEFT, RIGHT, UP, DOWN].some((keys) => keys.has(event.key))) return
      event.preventDefault()
      held.add(event.key)
      publish()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (held.delete(event.key)) publish()
    }
    const releaseAll = () => {
      held.clear()
      publish()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAll)
      // Whatever was held is let go of, so the next enabling starts clean.
      if (current.dx !== 0 || current.dy !== 0) handlers.current.onMove(0, 0)
    }
  }, [enabled])
}
