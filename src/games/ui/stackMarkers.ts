/**
 * Placing players' markers along a progress bar (Type Racer's race bar, Mage
 * Battle's battle bar) without letting a crowd move the bar.
 *
 * Markers too close to sit side by side are raised a level, but only up to
 * MAX_LEVEL. Past that a marker is not drawn at all: it is counted on the
 * top marker of its pile, which shows "+N". The bar reserves room for the
 * same few levels whatever happens, so it never jumps as players bunch up.
 */

/** Levels above the track: 0 sits on it, so a pile is at most MAX_LEVEL + 1 markers tall. */
export const MAX_LEVEL = 2

export interface BarMarker {
  id: string
  /** Where along the bar, 0 to 1. */
  fraction: number
}

export interface StackedMarkers {
  /** The level each drawn marker sits at. A marker missing here is folded into a pile. */
  levels: Map<string, number>
  /** For the top marker of an overfull pile: the markers folded into it, not drawn. */
  folded: Map<string, string[]>
}

/**
 * How many levels the bar keeps room for: as many as this many markers could
 * ever need, up to MAX_LEVEL. It depends only on how many players there are,
 * so the bar's height is set for the whole round.
 */
export const reservedLevels = (markerCount: number): number => Math.min(MAX_LEVEL, Math.max(0, markerCount - 1))

/**
 * Stacks the markers. `selfId`'s marker is placed first, so it is always
 * drawn and as low as it can be; the rest go from the front of the bar back,
 * so the leaders stay down on the track.
 */
export function stackMarkers(markers: readonly BarMarker[], selfId: string | null, overlap: number): StackedMarkers {
  const levels = new Map<string, number>()
  const folded = new Map<string, string[]>()
  const placed: BarMarker[][] = Array.from({ length: MAX_LEVEL + 1 }, () => [])

  const order = [...markers].sort(
    (a, b) => Number(b.id === selfId) - Number(a.id === selfId) || b.fraction - a.fraction,
  )
  for (const marker of order) {
    const isClear = (level: number) => placed[level]!.every((other) => Math.abs(other.fraction - marker.fraction) >= overlap)
    const level = placed.findIndex((_, index) => isClear(index))
    if (level !== -1) {
      placed[level]!.push(marker)
      levels.set(marker.id, level)
      continue
    }
    // Every level is taken here: count it on the nearest marker at the top of the pile.
    const top = placed[MAX_LEVEL]!.reduce((nearest, other) =>
      Math.abs(other.fraction - marker.fraction) < Math.abs(nearest.fraction - marker.fraction) ? other : nearest,
    )
    folded.set(top.id, [...(folded.get(top.id) ?? []), marker.id])
  }
  return { levels, folded }
}
