import { CUBE_COUNTER } from '../../shared/games/cubeCounter/constants.ts'
import type { Box } from '../../shared/games/cubeCounter/types.ts'

const { GRID_SIZE, MAX_LEVELS } = CUBE_COUNTER

/** Pixels per cell edge. */
export const UNIT = 46

const COS30 = Math.cos(Math.PI / 6)

export interface Point2 {
  x: number
  y: number
}

/**
 * The server's camera sits at the high-x, high-y, high-z corner, so a point
 * with bigger x or y lands lower on screen and x pushes right while y pushes
 * left. That makes the top, +x and +y faces the three a player can see.
 */
export const project = (x: number, y: number, z: number): Point2 => ({
  x: (x - y) * UNIT * COS30,
  y: (x + y) * UNIT * 0.5 - z * UNIT,
})

const PAD = 14

export const VIEW_BOX = {
  x: -GRID_SIZE * UNIT * COS30 - PAD,
  y: -MAX_LEVELS * UNIT - PAD,
  width: 2 * GRID_SIZE * UNIT * COS30 + 2 * PAD,
  height: (GRID_SIZE + MAX_LEVELS) * UNIT + 2 * PAD,
}

/** Width over height of a scene, so its box can scale without distorting it. */
export const SCENE_ASPECT = VIEW_BOX.width / VIEW_BOX.height

const corners = (list: [number, number, number][]): Point2[] => list.map(([x, y, z]) => project(x, y, z))

const points = (list: [number, number, number][]): string =>
  corners(list)
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')

export interface BoxFaces {
  top: string
  sideX: string
  sideY: string
}

/** The three faces a player can see, as corner lists (for drawing on a canvas). */
export interface BoxFaceCorners {
  top: Point2[]
  sideX: Point2[]
  sideY: Point2[]
}

const faceCorners = ({ x, y, z, width, depth }: Box): Record<keyof BoxFaces, [number, number, number][]> => ({
  top: [
    [x, y, z + 1],
    [x + width, y, z + 1],
    [x + width, y + depth, z + 1],
    [x, y + depth, z + 1],
  ],
  sideX: [
    [x + width, y, z],
    [x + width, y + depth, z],
    [x + width, y + depth, z + 1],
    [x + width, y, z + 1],
  ],
  sideY: [
    [x, y + depth, z],
    [x + width, y + depth, z],
    [x + width, y + depth, z + 1],
    [x, y + depth, z + 1],
  ],
})

export const boxFaces = (box: Box): BoxFaces => {
  const faces = faceCorners(box)
  return { top: points(faces.top), sideX: points(faces.sideX), sideY: points(faces.sideY) }
}

export const boxFaceCorners = (box: Box): BoxFaceCorners => {
  const faces = faceCorners(box)
  return { top: corners(faces.top), sideX: corners(faces.sideX), sideY: corners(faces.sideY) }
}

/** True when `front` sits on the camera side of `back` along some axis. */
const inFrontOf = (front: Box, back: Box): boolean =>
  front.x >= back.x + back.width ||
  front.y >= back.y + back.depth ||
  front.z >= back.z + 1

/**
 * Painter's order: every box is drawn after the boxes behind it. Boxes never
 * overlap, so "behind" is decided by which side of a separating plane each
 * one is on.
 */
export function drawOrder(boxes: readonly Box[]): Box[] {
  const ordered: Box[] = []
  const visited = new Set<number>()

  const visit = (index: number) => {
    if (visited.has(index)) return
    visited.add(index)
    boxes.forEach((other, otherIndex) => {
      if (otherIndex !== index && inFrontOf(boxes[index], other) && !inFrontOf(other, boxes[index])) {
        visit(otherIndex)
      }
    })
    ordered.push(boxes[index])
  }

  boxes.forEach((_, index) => { visit(index) })
  return ordered
}

/** The floor's outline plus its grid lines, as SVG line segments. */
export function floorLines(): [Point2, Point2][] {
  const lines: [Point2, Point2][] = []
  for (let i = 0; i <= GRID_SIZE; i += 1) {
    lines.push([project(i, 0, 0), project(i, GRID_SIZE, 0)])
    lines.push([project(0, i, 0), project(GRID_SIZE, i, 0)])
  }
  return lines
}

const FLOOR: [number, number, number][] = [
  [0, 0, 0],
  [GRID_SIZE, 0, 0],
  [GRID_SIZE, GRID_SIZE, 0],
  [0, GRID_SIZE, 0],
]

export const floorOutline = points(FLOOR)

export const floorCorners: Point2[] = corners(FLOOR)
