/**
 * Rivals in Minefield are drawn from their progress reports with the shared
 * `RemoteTrack` (see games/three/remoteTrack.ts), this far in the past.
 */

export { RemoteTrack } from '../three/remoteTrack.ts'

/** A little over one report interval (5 a second) plus the trip, so there is nearly always a report ahead. */
export const REMOTE_DELAY_MS = 300
