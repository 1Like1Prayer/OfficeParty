/**
 * One joined party room, as an external store React can subscribe to
 * (`useSyncExternalStore`).
 *
 * It owns every listener on the Colyseus room, so screens never touch the SDK:
 *
 * - **State patches** become a RoomView and live progress. Each is replaced
 *   only when its content changed, so a progress tick doesn't re-render the
 *   lobby.
 * - **Messages** (round data, results, closing, leaderboard) fold into
 *   RoundEvents.
 * - **Clock sync** pings the server and keeps a ClockSync estimate. Once a
 *   start is scheduled, its local time is fixed for that attempt, so a
 *   game's elapsed time never moves while the estimate eases.
 */

import { ClockSync, nextPingDelayMs } from '../shared/clockSync.ts'
import {
  ClientRequest,
  ServerMessage,
  type PingReply,
  type RoundResultsPayload,
} from '../shared/protocol.ts'
import type { PartyStateJson } from '../shared/partyState.ts'
import {
  NO_ROUND_EVENTS,
  onGameStarting,
  onLeaderboard,
  onLeftLeaderboard,
  onRoundClosing,
  onRoundData,
  onRoundResults,
  type RoundEvents,
} from './roundEvents.ts'
import {
  readPartyState,
  toProgressByPlayer,
  toRoomView,
  type ProgressByPlayer,
  type RoomView,
} from './roomView.ts'
import type { PartyRoom } from './types.ts'

/** When the current attempt's countdown and clock start, in local `performance.now()` time. */
export interface LocalSchedule {
  roundId: number
  attempt: number
  startAtLocalMs: number
  timingStartsAtLocalMs: number
  countdownMs: number
}

export interface PartySnapshot {
  room: RoomView
  progress: ProgressByPlayer
  events: RoundEvents
  schedule: LocalSchedule | null
  /** False while the SDK is reconnecting a dropped connection. */
  isConnected: boolean
}

/** The decoded state has its maps once the first full state has been applied. */
const hasArrived = (state: Partial<PartyStateJson>): boolean => state.players !== undefined

export class PartyConnection {
  readonly room: PartyRoom
  readonly clock = new ClockSync()

  private snapshot: PartySnapshot
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribers: Array<() => void> = []
  private lastRoomKey = ''
  private lastProgressKey = ''
  private pingTimer: ReturnType<typeof setTimeout> | null = null
  private pingsSent = 0
  private disposed = false
  private readonly onClosed: (code: number) => void

  /**
   * Wait for the room's first full state, then connect. A join resolves
   * before that state arrives, and the screens should never see a half-joined room.
   *
   * @param onClosed called once if the room ends for any reason other than `leave()`.
   */
  static async open(room: PartyRoom, onClosed: (code: number) => void): Promise<PartyConnection> {
    if (!hasArrived(readPartyState(room))) {
      await new Promise<void>((resolve) => { room.onStateChange.once(() => { resolve() }) })
    }
    return new PartyConnection(room, onClosed)
  }

  private constructor(room: PartyRoom, onClosed: (code: number) => void) {
    this.room = room
    this.onClosed = onClosed
    const state = readPartyState(room)
    this.snapshot = {
      room: this.trackRoom(state),
      progress: this.trackProgress(state),
      events: NO_ROUND_EVENTS,
      schedule: null,
      isConnected: true,
    }
    this.listen()
    this.ping()
  }

  get playerId(): string {
    return this.room.sessionId
  }

  /* --------------------- useSyncExternalStore contract --------------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): PartySnapshot => this.snapshot

  /* ------------------------------- talking -------------------------------- */

  /** A request the server answers. Rejects with an Error whose `reason` is a RequestError. */
  request<TReply>(type: string, payload?: unknown): Promise<TReply> {
    return this.room.request(type as never, payload as never) as Promise<TReply>
  }

  /** Fire and forget. */
  send(type: string, payload: unknown): void {
    this.room.send(type as never, payload as never)
  }

  /** An explicit leave: the seat is given up straight away. */
  async leave(): Promise<void> {
    this.dispose()
    await this.room.leave(true).catch(() => undefined)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.pingTimer !== null) clearTimeout(this.pingTimer)
    this.unsubscribers.forEach((unsubscribe) => unsubscribe())
    this.listeners.clear()
  }

  /* -------------------------------- inbound -------------------------------- */

  private listen(): void {
    const { room } = this
    const onState = () => { this.applyState(readPartyState(room)) }
    room.onStateChange(onState)
    this.unsubscribers.push(() => room.onStateChange.remove(onState))

    this.on(ServerMessage.GameStarting, (events) => onGameStarting(events))
    this.on(ServerMessage.RoundData, onRoundData)
    this.on(ServerMessage.RoundClosing, onRoundClosing)
    this.on<RoundResultsPayload>(ServerMessage.RoundResults, (events, payload) =>
      onRoundResults(events, payload, performance.now()),
    )
    this.on(ServerMessage.Leaderboard, onLeaderboard)

    const onDrop = () => { this.update({ isConnected: false }) }
    const onReconnect = () => { this.update({ isConnected: true }) }
    const onLeave = (code: number) => {
      if (this.disposed) return
      this.dispose()
      this.onClosed(code)
    }
    room.onDrop(onDrop)
    room.onReconnect(onReconnect)
    room.onLeave(onLeave)
    this.unsubscribers.push(
      () => room.onDrop.remove(onDrop),
      () => room.onReconnect.remove(onReconnect),
      () => room.onLeave.remove(onLeave),
    )
  }

  /** Fold one server message type into the round events. */
  private on<TPayload>(
    type: string,
    reduce: (events: RoundEvents, payload: TPayload) => RoundEvents,
  ): void {
    const unsubscribe = this.room.onMessage(type as never, (payload: TPayload) => {
      this.update({ events: reduce(this.snapshot.events, payload) })
    })
    this.unsubscribers.push(unsubscribe)
  }

  private applyState(state: PartyStateJson): void {
    const room = this.trackRoom(state)
    const progress = this.trackProgress(state)
    const events =
      state.phase === 'leaderboard' ? this.snapshot.events : onLeftLeaderboard(this.snapshot.events)
    this.update({ room, progress, events, schedule: this.scheduleFor(state) })
  }

  /** The previous view object when nothing changed, so React can skip work. */
  private trackRoom(state: PartyStateJson): RoomView {
    const next = toRoomView(state)
    const key = JSON.stringify(next)
    if (key === this.lastRoomKey) return this.snapshot.room
    this.lastRoomKey = key
    return next
  }

  private trackProgress(state: PartyStateJson): ProgressByPlayer {
    const next = toProgressByPlayer(state)
    const key = JSON.stringify(next)
    if (key === this.lastProgressKey) return this.snapshot.progress
    this.lastProgressKey = key
    return next
  }

  /**
   * Convert the scheduled start into local time once per attempt, and only
   * after the clock has a sample: a game measures its player from this
   * moment, so it must not shift mid-round.
   */
  private scheduleFor(state: PartyStateJson): LocalSchedule | null {
    const { roundId, attempt, startAtMs, timingStartsAtMs, countdownMs } = state.round
    const current = this.snapshot?.schedule ?? null
    if (current?.roundId === roundId && current.attempt === attempt) return current
    if (startAtMs === undefined || timingStartsAtMs === undefined || !this.clock.isSynced) return null

    const localNowMs = performance.now()
    return {
      roundId,
      attempt,
      startAtLocalMs: this.clock.toLocalTime(startAtMs, localNowMs),
      timingStartsAtLocalMs: this.clock.toLocalTime(timingStartsAtMs, localNowMs),
      countdownMs,
    }
  }

  private update(patch: Partial<PartySnapshot>): void {
    if (this.disposed) return
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  /* ------------------------------- clock sync ------------------------------ */

  /** A quick burst after joining, then a slow steady cadence; see ClockSync. */
  private ping = async (): Promise<void> => {
    const sentAtLocalMs = performance.now()
    try {
      const reply = await this.request<PingReply>(ClientRequest.Ping)
      const firstSample = !this.clock.isSynced
      this.clock.addSample(sentAtLocalMs, performance.now(), reply.serverTimeMs)
      // A start may have been waiting on the first sample to be placed locally.
      if (firstSample) this.applyState(readPartyState(this.room))
    } catch {
      // Dropped or closing: the next ping tries again.
    }
    if (!this.disposed) this.pingTimer = setTimeout(this.ping, nextPingDelayMs(++this.pingsSent))
  }
}
