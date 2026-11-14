import { useEffect, useState } from 'react'

export interface VisibleViewport {
  /** The bottom of what can actually be seen, in the page's own coordinates: above a phone's keyboard. */
  bottom: number
  height: number
}

const read = (): VisibleViewport => {
  const viewport = window.visualViewport
  if (!viewport) return { bottom: window.innerHeight, height: window.innerHeight }
  return { bottom: viewport.offsetTop + viewport.height, height: viewport.height }
}

/**
 * The part of the page the player can see right now. A phone's on-screen
 * keyboard covers the bottom of the page without resizing it, so this is the
 * only way to know how much room is left above the keyboard.
 */
export function useVisibleViewport(): VisibleViewport {
  const [visible, setVisible] = useState(read)

  useEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      const next = read()
      setVisible((current) =>
        Math.abs(current.bottom - next.bottom) < 1 && Math.abs(current.height - next.height) < 1 ? current : next,
      )
    }
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return visible
}
