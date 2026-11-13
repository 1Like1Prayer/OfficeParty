import { useMemo, useState } from 'react'
import type { PointerEvent } from 'react'

interface HoverHandlers {
  onPointerEnter: (event: PointerEvent) => void
  onPointerLeave: () => void
}

/**
 * Hover state without a stylesheet — the design's raised controls need it.
 * Mouse only: a tap on a touch screen would otherwise leave the control stuck
 * looking pressed until something else was tapped.
 */
export function useHover(): [boolean, HoverHandlers] {
  const [hovered, setHovered] = useState(false)
  const handlers = useMemo<HoverHandlers>(
    () => ({
      onPointerEnter: (event) => { if (event.pointerType === 'mouse') setHovered(true) },
      onPointerLeave: () => { setHovered(false) },
    }),
    [],
  )
  return [hovered, handlers]
}
