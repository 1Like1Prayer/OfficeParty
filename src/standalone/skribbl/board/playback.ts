/**
 * Replays the drawer's strokes at the pace they were drawn. Packets arrive
 * about 20 times a second; drawing each the moment it lands would make the
 * line jump forward in 50 ms chunks. Instead every point is scheduled by its
 * `dtMs`, starting a little after its packet arrives (the playout delay, as
 * the netcode guide's interpolation delay), so the line flows smoothly.
 *
 * If the queue ever falls far behind (a slow tab, a burst after a stall),
 * the pace is sped up until it catches up.
 */

import type { CanvasOp } from '../../../shared/standalone/skribbl/canvas.ts'

const PLAYOUT_DELAY_MS = 100
/** Further behind than this, points play at double speed. */
const CATCH_UP_AFTER_MS = 400

interface Scheduled {
  atMs: number
  op: CanvasOp
}

export class Playback {
  private queue: Scheduled[] = []
  /** When the last scheduled op plays. */
  private cursorMs = 0

  /** Schedule a packet's ops, received at `nowMs` (performance.now()). */
  push(ops: readonly CanvasOp[], nowMs: number): void {
    let at = Math.max(nowMs + PLAYOUT_DELAY_MS, this.cursorMs)
    const pace = at - nowMs > CATCH_UP_AFTER_MS ? 0.5 : 1
    for (const op of ops) {
      if (op.op !== 'points') {
        this.queue.push({ atMs: at, op })
        continue
      }
      for (const point of op.points) {
        at += point.dtMs * pace
        this.queue.push({ atMs: at, op: { op: 'points', points: [point] } })
      }
    }
    this.cursorMs = at
  }

  /** The ops due by `nowMs`, in order, taken off the queue. */
  due(nowMs: number): CanvasOp[] {
    let count = 0
    while (count < this.queue.length && this.queue[count]!.atMs <= nowMs) count++
    if (count === 0) return []
    return this.queue.splice(0, count).map(({ op }) => op)
  }

  /** Everything still queued, at once (a new turn, or a snapshot that replaces it all). */
  drain(): CanvasOp[] {
    const ops = this.queue.map(({ op }) => op)
    this.queue = []
    this.cursorMs = 0
    return ops
  }

  clear(): void {
    this.queue = []
    this.cursorMs = 0
  }

  get isIdle(): boolean {
    return this.queue.length === 0
  }
}
