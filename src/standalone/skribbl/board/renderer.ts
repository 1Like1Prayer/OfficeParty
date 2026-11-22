/**
 * Draws canvas ops onto the fixed-size bitmap, and keeps the drawing as a
 * CanvasModel so an undo can redraw everything that is left.
 *
 * Strokes are drawn one segment at a time, both live and on a redraw, so a
 * redrawn picture matches the live one pixel for pixel (which keeps later
 * fills covering the same area).
 */

import { CANVAS } from '../../../shared/standalone/skribbl/constants.ts'
import { CanvasModel, type CanvasAction, type CanvasOp } from '../../../shared/standalone/skribbl/canvas.ts'
import { BACKGROUND_COLOR, colorOf, widthOf } from '../palette.ts'
import { floodFill } from './floodFill.ts'

interface Pen {
  x: number
  y: number
  color: string
  width: number
}

export class BoardRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private model = new CanvasModel()
  /** The open stroke's last point, while one is being drawn. */
  private pen: Pen | null = null

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = CANVAS.WIDTH
    canvas.height = CANVAS.HEIGHT
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('No 2D canvas')
    this.ctx = ctx
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.reset()
  }

  get isEmpty(): boolean {
    return this.model.isEmpty
  }

  /** A blank canvas and an empty model, for a new turn. */
  reset(): void {
    this.model = new CanvasModel()
    this.pen = null
    this.paintBackground()
  }

  /** Apply ops in order. Returns false if the model refused one (it is then skipped). */
  apply(ops: readonly CanvasOp[]): boolean {
    let all = true
    for (const op of ops) all = this.applyOne(op) && all
    return all
  }

  private applyOne(op: CanvasOp): boolean {
    if (!this.model.tryApply([op])) return false
    switch (op.op) {
      case 'begin':
        this.pen = { x: op.x, y: op.y, color: colorOf(op.color), width: widthOf(op.size) }
        this.dot(this.pen)
        break
      case 'points':
        for (const point of op.points) this.segmentTo(point.x, point.y)
        break
      case 'end':
        this.pen = null
        break
      case 'fill':
        this.pen = null
        floodFill(this.ctx, op.x, op.y, colorOf(op.color))
        break
      case 'undo':
      case 'clear':
        this.pen = null
        this.redraw()
        break
    }
    return true
  }

  private redraw(): void {
    this.paintBackground()
    for (const action of this.model.actionList) this.drawAction(action)
  }

  private drawAction(action: CanvasAction): void {
    if (action.kind === 'fill') {
      floodFill(this.ctx, action.x, action.y, colorOf(action.color))
      return
    }
    const [first, ...rest] = action.points
    if (!first) return
    // A redraw only follows an undo or a clear, both of which close any open stroke.
    this.pen = { x: first.x, y: first.y, color: colorOf(action.color), width: widthOf(action.size) }
    this.dot(this.pen)
    for (const point of rest) this.segmentTo(point.x, point.y)
    this.pen = null
  }

  private dot(pen: Pen): void {
    const { ctx } = this
    ctx.fillStyle = pen.color
    ctx.beginPath()
    ctx.arc(pen.x, pen.y, pen.width / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  private segmentTo(x: number, y: number): void {
    const pen = this.pen
    if (!pen) return
    const { ctx } = this
    ctx.strokeStyle = pen.color
    ctx.lineWidth = pen.width
    ctx.beginPath()
    ctx.moveTo(pen.x, pen.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    pen.x = x
    pen.y = y
  }

  private paintBackground(): void {
    this.ctx.fillStyle = colorOf(BACKGROUND_COLOR)
    this.ctx.fillRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT)
  }
}
