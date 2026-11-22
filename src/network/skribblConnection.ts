/**
 * One joined Skribbl room, as an external store React can subscribe to
 * (`useSyncExternalStore`). Like PartyConnection, it owns every listener on
 * the Colyseus room so screens never touch the SDK:
 *
 * - **State patches** become a SkribblView.
 * - **Messages** (word choices, the word, chat, turn and game endings) fold
 *   into the snapshot.
 * - **Drawing bytes** never go through React: the board subscribes to them
 *   with `onDraw`, and reads the turn's packets so far with `drawLog` when it
 *   mounts (a player who joins mid-turn gets the whole drawing as one packet).
 * - **Clock sync**, for the turn timer.
 */

import type { Room } from '@colyseus/sdk'
import { ClockSync, nextPingDelayMs } from '../shared/clockSync.ts'
import { ClientRequest, type PingReply } from '../shared/protocol.ts'
import { SKRIBBL_CHAT } from '../shared/standalone/skribbl/constants.ts'
import {
  SkribblBytes,
  SkribblMessage,
  SkribblRequest,
  type ChatChannel,
  type ChatPayload,
  type ChooseWordReply,
  type GameEndedPayload,
  type SayReply,
  type SkribblPhase,
  type SkribblSettings,
  type TurnEndedPayload,
  type TurnPhase,
  type UpdateSettingsRequest,
  type WordChoicesPayload,
  type WordPayload,
} from '../shared/standalone/skribbl/protocol.ts'
import type { SkribblStateJson } from '../shared/standalone/skribbl/state.ts'
import { describeRequestError } from './errors.ts'

export interface SkribblPlayerView {
  playerId: string
  name: string
  avatar: string
  connected: boolean
  isOwner: boolean
  points: number
  joinOrder: number
}

export interface SkribblTurnView {
  phase: TurnPhase
  turnId: number
  round: number
  totalRounds: number
  drawerId: string | null
  endsAtServerMs: number | null
  drawTimeMs: number
  wordPattern: string
  guessed: string[]
}

export interface SkribblView {
  roomCode: string
  phase: SkribblPhase
  ownerId: string
  /** In join order. */
  players: SkribblPlayerView[]
  settings: SkribblSettings
  canStart: boolean
  blockedReason: 'not_enough_players' | null
  minPlayers: number
  maxPlayers: number
  turn: SkribblTurnView
}

/**
 * A line in the chat. `close` and `notice` are only ever this player's own:
 * the server tells nobody else a guess was close, and a refusal is ours alone.
 */
export type ChatLine =
  | { id: number; kind: 'message'; playerId: string; text: string; channel: ChatChannel }
  | { id: number; kind: 'guessed'; playerId: string; points: number }
  | { id: number; kind: 'close'; text: string }
  | { id: number; kind: 'notice'; text: string }
  | { id: number; kind: 'turn'; text: string }

/** A chat line before it has an id. */
type NewChatLine = ChatLine extends infer Line ? (Line extends ChatLine ? Omit<Line, 'id'> : never) : never

export interface SkribblSnapshot {
  view: SkribblView
  /** Only for the drawer, and only for the turn it names. */
  wordChoices: WordChoicesPayload | null
  /** The drawer's word, or a guesser's once they get it; for the turn it names. */
  word: WordPayload | null
  chat: ChatLine[]
  turnEnded: TurnEndedPayload | null
  gameEnded: GameEndedPayload | null
  isConnected: boolean
}

export type DrawListener = (bytes: Uint8Array, kind: 'live' | 'snapshot') => void

/** Chat kept on screen; older lines scroll away for good. */
const MAX_CHAT_LINES = 150

const hasArrived = (state: Partial<SkribblStateJson>): boolean => state.players !== undefined

const readState = (room: Room): SkribblStateJson =>
  (room.state as { toJSON(): unknown }).toJSON() as SkribblStateJson

/** The turn a draw packet belongs to: bytes 1-4 of its header, little-endian. */
const packetTurnId = (bytes: Uint8Array): number | null =>
  bytes.byteLength >= 5 ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1, true) : null

export function toSkribblView(state: SkribblStateJson): SkribblView {
  const players = Object.values(state.players)
    .sort((a, b) => a.joinOrder - b.joinOrder)
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      avatar: player.avatar,
      connected: player.connected,
      isOwner: player.isOwner,
      points: player.points,
      joinOrder: player.joinOrder,
    }))
  const { turn } = state
  return {
    roomCode: state.roomCode,
    phase: state.phase,
    ownerId: state.ownerId,
    players,
    settings: { ...state.settings },
    canStart: state.canStart,
    blockedReason: state.blockedReason === '' ? null : state.blockedReason,
    minPlayers: state.minPlayers,
    maxPlayers: state.maxPlayers,
    turn: {
      phase: turn.phase,
      turnId: turn.turnId,
      round: turn.round,
      totalRounds: turn.totalRounds,
      drawerId: turn.drawerId === '' ? null : turn.drawerId,
      endsAtServerMs: turn.endsAtMs > 0 ? turn.endsAtMs : null,
      drawTimeMs: turn.drawTimeMs,
      wordPattern: turn.wordPattern,
      guessed: [...turn.guessed],
    },
  }
}

export class SkribblConnection {
  readonly room: Room
  readonly clock = new ClockSync()

  private snapshot: SkribblSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly drawListeners = new Set<DrawListener>()
  private readonly unsubscribers: Array<() => void> = []
  private lastViewKey = ''
  private nextLineId = 1
  /** The current turn's drawing so far, as the packets that built it. */
  private log: { turnId: number; packets: Uint8Array[] } = { turnId: 0, packets: [] }
  private pingTimer: ReturnType<typeof setTimeout> | null = null
  private pingsSent = 0
  private disposed = false
  private readonly onClosed: (code: number) => void

  static async open(room: Room, onClosed: (code: number) => void): Promise<SkribblConnection> {
    if (!hasArrived(readState(room))) {
      await new Promise<void>((resolve) => { room.onStateChange.once(() => { resolve() }) })
    }
    return new SkribblConnection(room, onClosed)
  }

  private constructor(room: Room, onClosed: (code: number) => void) {
    this.room = room
    this.onClosed = onClosed
    const view = toSkribblView(readState(room))
    this.lastViewKey = JSON.stringify(view)
    this.log = { turnId: view.turn.turnId, packets: [] }
    this.snapshot = {
      view,
      wordChoices: null,
      word: null,
      chat: [],
      turnEnded: null,
      gameEnded: null,
      isConnected: true,
    }
    this.listen()
    void this.ping()
  }

  get playerId(): string {
    return this.room.sessionId
  }

  /* --------------------- useSyncExternalStore contract --------------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): SkribblSnapshot => this.snapshot

  /* ------------------------------- drawing -------------------------------- */

  /** The packets that drew turn `turnId` so far (empty for any other turn). */
  drawLog(turnId: number): readonly Uint8Array[] {
    return this.log.turnId === turnId ? this.log.packets : []
  }

  onDraw(listener: DrawListener): () => void {
    this.drawListeners.add(listener)
    return () => this.drawListeners.delete(listener)
  }

  /** The drawer's own packet: sent, and kept so the board can be rebuilt. */
  sendDraw(bytes: Uint8Array): void {
    if (!this.keep(bytes, false)) return
    this.room.sendBytes(SkribblBytes.Draw, bytes)
  }

  /** Where a room-timeline time falls on `performance.now()`, once the clock has a sample. */
  toLocalMs(serverMs: number): number | null {
    return this.clock.isSynced ? this.clock.toLocalTime(serverMs, performance.now()) : null
  }

  /* ------------------------------- requests -------------------------------- */

  async say(text: string): Promise<void> {
    const trimmed = text.trim().slice(0, SKRIBBL_CHAT.MAX_LENGTH)
    if (trimmed === '') return
    try {
      const reply = await this.request<SayReply>(SkribblRequest.Say, { text: trimmed })
      if (reply.verdict === 'close') this.addLine({ kind: 'close', text: `“${trimmed}” is close!` })
    } catch (failure) {
      this.addLine({ kind: 'notice', text: describeRequestError(failure) })
    }
  }

  chooseWord(index: number): Promise<ChooseWordReply> {
    const choices = this.snapshot.wordChoices
    return this.request<ChooseWordReply>(SkribblRequest.ChooseWord, { turnId: choices?.turnId ?? 0, index })
  }

  start(): Promise<unknown> {
    return this.request(SkribblRequest.Start)
  }

  updateSettings(update: UpdateSettingsRequest): Promise<unknown> {
    return this.request(SkribblRequest.UpdateSettings, update)
  }

  returnToLobby(): Promise<unknown> {
    return this.request(SkribblRequest.ReturnToLobby)
  }

  kick(playerId: string): Promise<unknown> {
    return this.request(ClientRequest.KickPlayer, { playerId })
  }

  /** Rejects with an Error whose `reason` is a RequestError. */
  request<TReply>(type: string, payload?: unknown): Promise<TReply> {
    return this.room.request(type as never, payload as never) as Promise<TReply>
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
    this.drawListeners.clear()
  }

  /* -------------------------------- inbound -------------------------------- */

  private listen(): void {
    const { room } = this
    const onState = () => { this.applyState(readState(room)) }
    room.onStateChange(onState)
    this.unsubscribers.push(() => room.onStateChange.remove(onState))

    this.on<WordChoicesPayload>(SkribblMessage.WordChoices, (wordChoices) => { this.update({ wordChoices }) })
    this.on<WordPayload>(SkribblMessage.Word, (word) => { this.update({ word }) })
    this.on<ChatPayload>(SkribblMessage.Chat, (payload) => {
      if (payload.kind === 'guessed') this.addLine({ kind: 'guessed', playerId: payload.playerId, points: payload.points })
      else this.addLine({ kind: 'message', playerId: payload.playerId, text: payload.text, channel: payload.channel })
    })
    this.on<TurnEndedPayload>(SkribblMessage.TurnEnded, (turnEnded) => {
      // A reconnect re-sends the last one; show its line only once.
      if (this.snapshot.turnEnded?.turnId === turnEnded.turnId) return
      this.update({ turnEnded })
      this.addLine({ kind: 'turn', text: turnEnded.word ? `The word was “${turnEnded.word}”` : 'The drawer left.' })
    })
    this.on<GameEndedPayload>(SkribblMessage.GameEnded, (gameEnded) => { this.update({ gameEnded }) })
    this.on<Uint8Array>(SkribblBytes.Draw, (bytes) => {
      if (this.keep(bytes, false)) this.emitDraw(bytes, 'live')
    })
    this.on<Uint8Array>(SkribblBytes.Canvas, (bytes) => {
      if (this.keep(bytes, true)) this.emitDraw(bytes, 'snapshot')
    })

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

  private on<TPayload>(type: string, handle: (payload: TPayload) => void): void {
    this.unsubscribers.push(this.room.onMessage(type as never, (payload: TPayload) => { handle(payload) }))
  }

  /** Keep a packet in the turn's log. A snapshot replaces what was there. False for an old turn's packet. */
  private keep(bytes: Uint8Array, isSnapshot: boolean): boolean {
    const turnId = packetTurnId(bytes)
    if (turnId === null || turnId < this.log.turnId) return false
    const copy = bytes.slice()
    if (turnId > this.log.turnId || isSnapshot) this.log = { turnId, packets: [copy] }
    else this.log.packets.push(copy)
    return true
  }

  private emitDraw(bytes: Uint8Array, kind: 'live' | 'snapshot'): void {
    this.drawListeners.forEach((listener) => { listener(bytes, kind) })
  }

  private applyState(state: SkribblStateJson): void {
    const view = toSkribblView(state)
    const key = JSON.stringify(view)
    if (key === this.lastViewKey) return
    const previous = this.snapshot.view
    this.lastViewKey = key

    const patch: Partial<SkribblSnapshot> = { view }
    if (view.turn.turnId > this.log.turnId) this.log = { turnId: view.turn.turnId, packets: [] }
    if (view.phase === 'lobby') {
      patch.turnEnded = null
      patch.gameEnded = null
      patch.wordChoices = null
      patch.word = null
    }
    if (previous.phase === 'lobby' && view.phase === 'playing') {
      patch.chat = [...this.snapshot.chat, this.line({ kind: 'turn', text: 'The game is on!' })].slice(-MAX_CHAT_LINES)
    }
    if (view.turn.turnId !== previous.turn.turnId && view.turn.drawerId !== null) {
      const drawer = view.players.find((player) => player.playerId === view.turn.drawerId)
      if (drawer) {
        const line = this.line({ kind: 'turn', text: `${drawer.name} is drawing now!` })
        patch.chat = [...(patch.chat ?? this.snapshot.chat), line].slice(-MAX_CHAT_LINES)
      }
    }
    this.update(patch)
  }

  private line(line: NewChatLine): ChatLine {
    return { ...line, id: this.nextLineId++ } as ChatLine
  }

  private addLine(line: NewChatLine): void {
    const next = this.line(line)
    this.update({ chat: [...this.snapshot.chat, next].slice(-MAX_CHAT_LINES) })
  }

  private update(patch: Partial<SkribblSnapshot>): void {
    if (this.disposed) return
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => { listener() })
  }

  /* ------------------------------- clock sync ------------------------------ */

  private ping = async (): Promise<void> => {
    const sentAtLocalMs = performance.now()
    try {
      const reply = await this.request<PingReply>(ClientRequest.Ping)
      const firstSample = !this.clock.isSynced
      this.clock.addSample(sentAtLocalMs, performance.now(), reply.serverTimeMs)
      // The timer can show now: re-publish so screens read the clock again.
      if (firstSample) this.update({})
    } catch {
      // Dropped or closing: the next ping tries again.
    }
    if (!this.disposed) this.pingTimer = setTimeout(this.ping, nextPingDelayMs(++this.pingsSent))
  }
}
