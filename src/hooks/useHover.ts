import { useMemo, useState } from 'react'
import type { PointerEvent } from 'react'
import { sfx } from '../audio/sfx/index.ts'

interface HoverHandlers {
  onPointerEnter: (event: PointerEvent) => void
  onPointerLeave: () => void
}

/**
 * Hover state without a stylesheet — the design's raised controls need it.
 * Mouse only: a tap on a touch screen would otherwise leave the control stuck
 * looking pressed until something else was tapped.
 *
 * The mouse moving onto the control plays a faint tick, unless it is disabled.
 */
export function useHover(): [boolean, HoverHandlers] {
  const [hovered, setHovered] = useState(false)
  const handlers = useMemo<HoverHandlers>(
    () => ({
      onPointerEnter: (event) => {
        if (event.pointerType !== 'mouse') return
        setHovered(true)
        if (!(event.currentTarget as HTMLButtonElement).disabled) sfx.ui.hover()
      },
      onPointerLeave: () => { setHovered(false) },
    }),
    [],
  )
  return [hovered, handlers]
}
