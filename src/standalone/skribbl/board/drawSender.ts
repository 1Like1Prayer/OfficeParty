/**
 * The drawer's outbox: ops are drawn locally at once and collected here,
 * then sent as one packet about 20 times a second. Runs of points are merged
 * into one op, and a packet that would pass the server's size limit is split.
 */

import { CANVAS } from '../../../shared/standalone/skribbl/constants.ts'
import { encodeDrawPacket, type CanvasOp } from '../../../shared/standalone/skribbl/canvas.ts'

export const SEND_INTERVAL_MS = 50

/** Leaves room under MAX_PACKET_BYTES for the header and the other ops. */
const MAX_POINTS_PER_PACKET = Math.floor((CANVAS.MAX_PACKET_BYTES - 200) / 5)

export class DrawSender {
  private pending: CanvasOp[] = []
  private readonly turnId: number
  private readonly send: (bytes: Uint8Array) => void

  constructor(turnId: number, send: (bytes: Uint8Array) => void) {
    this.turnId = turnId
    this.send = send
  }

  push(op: CanvasOp): void {
    const last = this.pending.at(-1)
    if (op.op === 'points' && last?.op === 'points') {
      last.points.push(...op.points)
      return
    }
    this.pending.push(op.op === 'points' ? { op: 'points', points: [...op.points] } : op)
  }

  flush(): void {
    if (this.pending.length === 0) return
    const ops = this.pending
    this.pending = []
    let batch: CanvasOp[] = []
    let points = 0
    const sendBatch = () => {
      if (batch.length > 0) this.send(encodeDrawPacket({ turnId: this.turnId, ops: batch }))
      batch = []
      points = 0
    }
    for (const op of ops) {
      if (op.op !== 'points') {
        batch.push(op)
        continue
      }
      for (let start = 0; start < op.points.length; ) {
        const room = MAX_POINTS_PER_PACKET - points
        if (room <= 0) {
          sendBatch()
          continue
        }
        const chunk = op.points.slice(start, start + room)
        batch.push({ op: 'points', points: chunk })
        points += chunk.length
        start += chunk.length
      }
    }
    sendBatch()
  }
}
