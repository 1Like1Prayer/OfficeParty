/**
 * Shapes are sent as ordinary strokes: a polyline through the outline. That
 * keeps the wire format and the server unchanged, and undo, fill and the
 * pen width work on them like on any stroke.
 */

import { CANVAS } from '../../../shared/standalone/skribbl/constants.ts'

export type ShapeKind = 'line' | 'rectangle' | 'triangle' | 'circle' | 'ellipse'

export interface Point {
  x: number
  y: number
}

/** Points around a curve: enough to look round at the biggest size. */
const CURVE_SEGMENTS = 72

const clampPoint = ({ x, y }: Point): Point => ({
  x: Math.round(Math.min(CANVAS.WIDTH - 1, Math.max(0, x))),
  y: Math.round(Math.min(CANVAS.HEIGHT - 1, Math.max(0, y))),
})

const around = (cx: number, cy: number, rx: number, ry: number): Point[] =>
  Array.from({ length: CURVE_SEGMENTS + 1 }, (_, i) => {
    const angle = (i / CURVE_SEGMENTS) * Math.PI * 2
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry }
  })

/**
 * The outline from where the drag started (`from`) to where it is (`to`),
 * clamped to the canvas (the server refuses points off it).
 *
 * - line: from one point to the other
 * - rectangle, ellipse: inside the box the drag spans
 * - triangle: point up, inside that box
 * - circle: centred where the drag started, through where it is
 */
export function shapePoints(kind: ShapeKind, from: Point, to: Point): Point[] {
  const left = Math.min(from.x, to.x)
  const right = Math.max(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  let points: Point[]
  switch (kind) {
    case 'line':
      points = [from, to]
      break
    case 'rectangle':
      points = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: left, y: top },
      ]
      break
    case 'triangle':
      points = [
        { x: (left + right) / 2, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: (left + right) / 2, y: top },
      ]
      break
    case 'circle': {
      const radius = Math.hypot(to.x - from.x, to.y - from.y)
      points = around(from.x, from.y, radius, radius)
      break
    }
    case 'ellipse':
      points = around((left + right) / 2, (top + bottom) / 2, (right - left) / 2, (bottom - top) / 2)
      break
  }
  // Drop repeats (a clamped curve can pile points up on an edge).
  return points.map(clampPoint).filter((point, i, all) => i === 0 || point.x !== all[i - 1]!.x || point.y !== all[i - 1]!.y)
}
