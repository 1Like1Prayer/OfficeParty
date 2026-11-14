/**
 * Where another player is, drawn from their reports.
 *
 * Reports arrive several times a second and not evenly, so a runner that
 * chased the newest one would lurch. Instead each player is drawn a fixed time
 * in the past, between the two reports either side of that time: the path they
 * really took, at an even pace. If the next report is late, the runner carries
 * on the way it was going for a moment and then waits.
 *
 * Times are race milliseconds, the same clock on every screen, so reports are
 * placed by when they were taken, not by when they arrived.
 */

/** Old reports are only needed while they are still ahead of, or just behind, the time drawn. */
const MAX_SAMPLES = 24

export interface TrackSample {
  /** Race time the report describes. */
  t: number
  x: number
  y: number
  /** Height, for games that have one. */
  z?: number
}

export interface TrackPoint {
  x: number
  y: number
  z: number
  /** Units per millisecond: how fast and which way they are going at this point. */
  vx: number
  vy: number
  vz: number
}

export class RemoteTrack {
  private readonly samples: Required<TrackSample>[] = []
  private readonly maxExtrapolationMs: number

  /** @param maxExtrapolationMs how long to carry on past the newest report before waiting. */
  constructor(maxExtrapolationMs = 200) {
    this.maxExtrapolationMs = maxExtrapolationMs
  }

  /** Adds a report. A report no newer than the last one is a repeat and is ignored. */
  push(sample: TrackSample): void {
    const last = this.samples.at(-1)
    if (last !== undefined && sample.t <= last.t) return
    this.samples.push({ ...sample, z: sample.z ?? 0 })
    if (this.samples.length > MAX_SAMPLES) this.samples.shift()
  }

  /** Forget every report, for a fresh attempt. */
  clear(): void {
    this.samples.length = 0
  }

  /** Where they were at race time `t`, or null before the first report. */
  at(t: number): TrackPoint | null {
    const { samples } = this
    const first = samples[0]
    if (first === undefined) return null
    const still = (sample: Required<TrackSample>): TrackPoint => ({
      x: sample.x, y: sample.y, z: sample.z, vx: 0, vy: 0, vz: 0,
    })
    if (t <= first.t || samples.length === 1) return still(first)

    for (let index = samples.length - 1; index > 0; index--) {
      const from = samples[index - 1]!
      const to = samples[index]!
      if (t < from.t) continue
      const span = to.t - from.t
      const vx = (to.x - from.x) / span
      const vy = (to.y - from.y) / span
      const vz = (to.z - from.z) / span
      // Between two reports, or a little past the newest, then waiting for the next.
      const along = Math.min(t, to.t + this.maxExtrapolationMs) - from.t
      const isMoving = t <= to.t + this.maxExtrapolationMs
      return {
        x: from.x + vx * along,
        y: from.y + vy * along,
        z: from.z + vz * along,
        vx: isMoving ? vx : 0,
        vy: isMoving ? vy : 0,
        vz: isMoving ? vz : 0,
      }
    }
    return still(first)
  }
}
