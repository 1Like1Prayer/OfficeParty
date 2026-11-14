/**
 * Client-side estimate of the room's server clock (netcode guide section 2).
 *
 * The browser pings with `ClientRequest.Ping` and feeds each reply in here.
 * The method is Cristian's algorithm, made more robust:
 *
 * - Every sample assumes the reply took half the round trip, so its error is
 *   at most half that round trip's queuing asymmetry. The sample with the
 *   lowest round trip among the last few is therefore the most trustworthy,
 *   and it is the only one used.
 * - The estimate never jumps during play: it eases toward the best sample at
 *   a bounded rate, so a countdown never skips or stalls. Only a real
 *   discontinuity (a frozen tab, a sleeping laptop) snaps.
 *
 * Pure: the caller passes every timestamp in, so this has no clock of its own
 * and is trivially testable. Times are milliseconds; local times come from
 * `performance.now()`, server times from the room timeline.
 */

import { CLOCK_SYNC } from './constants.js';

interface ClockSample {
    roundTripMs: number;
    /** serverTime - localTime implied by this sample. */
    offsetMs: number;
}

export interface ClockSyncOptions {
    sampleWindow?: number;
    maxSlewRate?: number;
    snapThresholdMs?: number;
}

export class ClockSync {
    private readonly samples: ClockSample[] = [];
    private readonly sampleWindow: number;
    private readonly maxSlewRate: number;
    private readonly snapThresholdMs: number;

    /** The offset currently applied (eased). Null until the first sample. */
    private appliedOffsetMs: number | null = null;
    /** The offset the best sample says is right. */
    private targetOffsetMs = 0;
    private lastEasedAtLocalMs = 0;

    constructor(options: ClockSyncOptions = {}) {
        this.sampleWindow = options.sampleWindow ?? CLOCK_SYNC.SAMPLE_WINDOW;
        this.maxSlewRate = options.maxSlewRate ?? CLOCK_SYNC.MAX_SLEW_RATE;
        this.snapThresholdMs = options.snapThresholdMs ?? CLOCK_SYNC.SNAP_THRESHOLD_MS;
    }

    get isSynced(): boolean {
        return this.appliedOffsetMs !== null;
    }

    /** Round trip of the sample currently trusted, for a debug overlay. */
    get bestRoundTripMs(): number | null {
        return this.bestSample()?.roundTripMs ?? null;
    }

    /**
     * Record one ping. `sentAtLocalMs` is when the request left, and
     * `receivedAtLocalMs` when the reply arrived.
     */
    addSample(sentAtLocalMs: number, receivedAtLocalMs: number, serverTimeMs: number): void {
        const roundTripMs = Math.max(0, receivedAtLocalMs - sentAtLocalMs);
        const offsetMs = serverTimeMs + roundTripMs / 2 - receivedAtLocalMs;

        // A sample can be wrong by at most half its own round trip. If it
        // disagrees by more than that plus the snap threshold, a clock jumped
        // (sleep, frozen tab) and every older sample is describing the past.
        const unexplainedMs = Math.abs(offsetMs - this.targetOffsetMs) - roundTripMs / 2;
        if (this.samples.length > 0 && unexplainedMs > this.snapThresholdMs) {
            this.samples.length = 0;
        }

        this.samples.push({ roundTripMs, offsetMs });
        if (this.samples.length > this.sampleWindow) this.samples.shift();

        this.targetOffsetMs = this.bestSample()!.offsetMs;
        if (
            this.appliedOffsetMs === null ||
            Math.abs(this.targetOffsetMs - this.easedOffset(receivedAtLocalMs)) >
                this.snapThresholdMs
        ) {
            this.appliedOffsetMs = this.targetOffsetMs;
        }
        this.lastEasedAtLocalMs = receivedAtLocalMs;
    }

    /** The room's current time, estimated from local `performance.now()`. */
    serverNow(localNowMs: number): number {
        return localNowMs + this.easedOffset(localNowMs);
    }

    /** Convert a scheduled server instant (a start, a deadline) into local time. */
    toLocalTime(serverTimeMs: number, localNowMs: number): number {
        return serverTimeMs - this.easedOffset(localNowMs);
    }

    private bestSample(): ClockSample | undefined {
        let best: ClockSample | undefined;
        for (const sample of this.samples) {
            // On equal round trips the newer sample wins, so slow drift is followed.
            if (best === undefined || sample.roundTripMs <= best.roundTripMs) best = sample;
        }
        return best;
    }

    /** Move the applied offset toward the target, no faster than the slew rate allows. */
    private easedOffset(localNowMs: number): number {
        if (this.appliedOffsetMs === null) return 0;
        const elapsedMs = Math.max(0, localNowMs - this.lastEasedAtLocalMs);
        const maxStepMs = elapsedMs * this.maxSlewRate;
        const errorMs = this.targetOffsetMs - this.appliedOffsetMs;
        this.appliedOffsetMs += Math.max(-maxStepMs, Math.min(maxStepMs, errorMs));
        this.lastEasedAtLocalMs = Math.max(this.lastEasedAtLocalMs, localNowMs);
        return this.appliedOffsetMs;
    }
}

/**
 * When to send the next ping: a quick burst after joining so the first
 * countdown is already accurate, then a slow steady cadence.
 */
export const nextPingDelayMs = (pingsSentSoFar: number): number =>
    pingsSentSoFar < CLOCK_SYNC.BURST_SIZE ? CLOCK_SYNC.BURST_INTERVAL_MS : CLOCK_SYNC.INTERVAL_MS;
