/**
 * Where a rival is, drawn from their progress reports.
 *
 * Reports arrive a few times a second and not evenly, so a runner that chased
 * the newest one would lurch. Instead each rival is drawn a fixed time in the
 * past (`REMOTE_DELAY_MS`), between the two reports either side of that time:
 * the path they really took, at an even pace. If the next report is late, the
 * runner carries on the way it was going for a moment and then waits.
 *
 * Times are race milliseconds, the same clock on every screen, so reports are
 * placed by when they were taken, not by when they arrived.
 */

/** A little over one report interval plus the trip, so there is nearly always a report ahead. */
export const REMOTE_DELAY_MS = 300
/** How long a rival is carried on past their latest report before they wait for the next one. */
const MAX_EXTRAPOLATION_MS = 200
/** Old reports are only needed while they are still ahead of, or just behind, the time drawn. */
const MAX_SAMPLES = 16

export interface TrackSample {
  /** Race time the report describes. */
  t: number
  x: number
  y: number
}

export interface TrackPoint {
  x: number
  y: number
  /** Tiles per millisecond: how fast and which way they are going at this point. */
  vx: number
  vy: number
}

export class RemoteTrack {
  private readonly samples: TrackSample[] = []

  /** Adds a report. A report no newer than the last one is a repeat and is ignored. */
  push(sample: TrackSample): void {
    const last = this.samples.at(-1)
    if (last !== undefined && sample.t <= last.t) return
    this.samples.push(sample)
    if (this.samples.length > MAX_SAMPLES) this.samples.shift()
  }

  /** Where the rival was at race time `t`, or null before the first report. */
  at(t: number): TrackPoint | null {
    const { samples } = this
    const first = samples[0]
    const last = samples.at(-1)
    if (first === undefined || last === undefined) return null
    if (t <= first.t || samples.length === 1) return { x: first.x, y: first.y, vx: 0, vy: 0 }

    for (let index = samples.length - 1; index > 0; index--) {
      const from = samples[index - 1]!
      const to = samples[index]!
      if (t < from.t) continue
      const vx = (to.x - from.x) / (to.t - from.t)
      const vy = (to.y - from.y) / (to.t - from.t)
      if (t <= to.t) {
        return { x: from.x + vx * (t - from.t), y: from.y + vy * (t - from.t), vx, vy }
      }
      // Past the newest report: keep going for a moment, then wait for the next.
      const ahead = t - to.t
      if (ahead > MAX_EXTRAPOLATION_MS) {
        return {
          x: to.x + vx * MAX_EXTRAPOLATION_MS,
          y: to.y + vy * MAX_EXTRAPOLATION_MS,
          vx: 0,
          vy: 0,
        }
      }
      return { x: to.x + vx * ahead, y: to.y + vy * ahead, vx, vy }
    }
    return { x: first.x, y: first.y, vx: 0, vy: 0 }
  }
}
