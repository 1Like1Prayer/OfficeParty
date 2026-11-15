import { LAYER_COUNT, layerHeight, TILES } from '../../shared/games/hexDrop/arena.ts'
import { HEX_DROP } from '../../shared/games/hexDrop/constants.ts'
import { startState, stepRunner, type Controls, type RunnerState } from '../../shared/games/hexDrop/movement.ts'
import type { Tile, TouchReply } from '../../shared/games/hexDrop/types.ts'
import type { RoundPlayerView } from '../../types/index.ts'
import { RemoteTrack } from '../three/remoteTrack.ts'
import { HexDropScene, type RunnerPose } from './scene/HexDropScene.ts'

const STEP_MS = HEX_DROP.STEP_SECONDS * 1000
const REPORT_INTERVAL_MS = 1000 / HEX_DROP.PROGRESS_HZ
/**
 * Others are drawn this far in the past. Reports go out 20 times a second and
 * reach the other screens on the room's 20-a-second state sync, so a little
 * over two intervals keeps a report ahead of the time drawn nearly always.
 */
const REMOTE_DELAY_MS = 120
/** How long another runner is carried on past their newest report before they wait for the next. */
const REMOTE_MAX_EXTRAPOLATION_MS = 150
/** The game keeps moving the runner while the tab is hidden and frames stop, at this rate. */
const BACKGROUND_TICK_MS = 250

const LEFT = new Set(['ArrowLeft', 'a', 'A'])
const RIGHT = new Set(['ArrowRight', 'd', 'D'])
const UP = new Set(['ArrowUp', 'w', 'W'])
const DOWN = new Set(['ArrowDown', 's', 'S'])
const JUMP = new Set([' '])

export interface HexDropSetup {
  host: HTMLElement
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  /** False for someone only watching: they have no runner. */
  isRunning: boolean
  /** Each player's starting tile. */
  spawns: Readonly<Record<string, number>>
  /** `performance.now()` value the round's clock starts at. */
  timingStartsAtLocalMs: number
}

export interface HexDropCallbacks {
  /** Tell the server this runner stood on a tile; it answers with when the tile drops. */
  touch: (tile: number, atMs: number) => Promise<unknown>
  /** Where this runner is, for the others' screens. */
  progress: (sample: Record<string, number>) => void
  /** This runner is done: fell out at `outAtMs`, or still up (null). Called once. */
  finish: (outAtMs: number | null) => void
}

type Progress = Readonly<Record<string, Readonly<Record<string, number>>>>

const centi = (value: number): number => Math.round(value * 100)

/**
 * Hex Drop in the browser: moves this player's runner, keeps track of the
 * tiles, and hands the scene a frame to draw.
 *
 * The runner moves at once on a key press: it is stepped here, in fixed steps
 * on the round's shared clock, with the same rules the tests check. Every
 * tile it stands on is reported with the time; the server's answer, and every
 * other player's touches, arrive as the round's shared world, so a tile drops
 * at the same moment on every screen. Other runners are drawn from their
 * position reports, a little in the past (see RemoteTrack).
 */
export class HexDropGame {
  private readonly scene: HexDropScene
  private readonly setup: HexDropSetup
  private readonly callbacks: HexDropCallbacks

  /** This runner, after the latest step and the one before (for drawing between them). */
  private state: RunnerState
  private previous: RunnerState
  private stepsDone = 0
  private finished = false
  private winners: ReadonlySet<string> = new Set()

  /** When each tile drops, as the server says, and as this runner's own touches predict. */
  private shared: Readonly<Record<string, number>> = {}
  private readonly predicted = new Map<number, number>()
  private readonly touched = new Set<number>()

  private readonly held = new Set<string>()
  private jumpPressed = false
  /** A phone's stick, as a direction and strength on screen axes; zero when let go. */
  private stick = { x: 0, z: 0 }
  /** The last direction pressed, kept after letting go: the runner faces it. */
  private facing: { x: number; z: number } | null = null
  private lastReportAtMs = -Infinity

  private readonly tracks = new Map<string, RemoteTrack>()
  private rivalsOut = new Set<string>()
  private readonly backgroundTimer: ReturnType<typeof setInterval>
  private readonly unlisten: () => void
  private frameId = 0

  constructor(setup: HexDropSetup, callbacks: HexDropCallbacks) {
    this.setup = setup
    this.callbacks = callbacks
    this.scene = new HexDropScene(setup.host)
    this.scene.setRoster(setup.players)

    const spawn = TILES[setup.spawns[setup.selfPlayerId] ?? 0]!
    this.state = startState(spawn)
    this.previous = this.state

    this.unlisten = this.listenToKeys()
    this.backgroundTimer = setInterval(() => { this.advance() }, BACKGROUND_TICK_MS)
    const loop = () => {
      this.advance()
      this.draw()
      this.frameId = requestAnimationFrame(loop)
    }
    this.frameId = requestAnimationFrame(loop)
  }

  /** The tiles' drop times as the server publishes them. */
  setShared(values: Readonly<Record<string, number>>): void {
    this.shared = values
  }

  /** The other players' position reports. */
  setProgress(progress: Progress): void {
    for (const { playerId } of this.setup.players) {
      if (playerId === this.setup.selfPlayerId) continue
      const report = progress[playerId]
      if (report?.t === undefined) continue
      let track = this.tracks.get(playerId)
      if (track === undefined) {
        track = new RemoteTrack(REMOTE_MAX_EXTRAPOLATION_MS)
        this.tracks.set(playerId, track)
      }
      track.push({ t: report.t, x: (report.x ?? 0) / 100, y: (report.z ?? 0) / 100, z: (report.y ?? 0) / 100 })
      if (report.out === 1) this.rivalsOut.add(playerId)
    }
  }

  /** The round is decided for this runner: stop where they are and report still being up. */
  /**
   * Steers with a phone's stick: any direction, at any strength, on screen
   * axes (x right, y down). The camera always looks the same way across the
   * arena, so screen up is -z, as the up arrow has it.
   */
  setStick(x: number, y: number): void {
    this.stick = { x, z: y }
  }

  /** A tap on a phone's jump button, taken like a press of Space. */
  pressJump(): void {
    this.jumpPressed = true
  }

  stop(): void {
    this.advance()
    this.finish(null)
  }

  /** Who won, once the server says. */
  setWinners(playerIds: ReadonlySet<string>): void {
    this.winners = playerIds
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId)
    clearInterval(this.backgroundTimer)
    this.unlisten()
    this.scene.dispose()
  }

  /* ---------------- the runner ---------------- */

  private raceMs(): number {
    return Math.min(performance.now() - this.setup.timingStartsAtLocalMs, HEX_DROP.MAX_ROUND_MS)
  }

  /** When a tile drops: the earlier of the server's word and this runner's own touch. */
  private fallAtMs = (tile: Tile): number | undefined => {
    const published = this.shared[String(tile.id)]
    const own = this.predicted.get(tile.id)
    if (published === undefined) return own
    return own === undefined ? published : Math.min(published, own)
  }

  /** Steps the runner up to the present on the round clock. */
  private advance(): void {
    if (!this.setup.isRunning || this.finished) return
    const nowMs = this.raceMs()
    if (nowMs < 0) {
      // A jump pressed during the countdown does not fire on the first step.
      this.jumpPressed = false
      return
    }

    const due = Math.floor(nowMs / STEP_MS)
    while (this.stepsDone < due && !this.finished) {
      const stepEndsAtMs = (this.stepsDone + 1) * STEP_MS
      const isStanding = (tile: Tile) => {
        const fallAtMs = this.fallAtMs(tile)
        return fallAtMs === undefined || fallAtMs > stepEndsAtMs
      }
      this.previous = this.state
      this.state = stepRunner(this.state, this.controls(), isStanding)
      this.stepsDone += 1

      if (this.state.tile !== null && !this.touched.has(this.state.tile)) {
        this.reportTouch(this.state.tile, Math.round(stepEndsAtMs))
      }
      if (this.state.out) this.finish(Math.round(stepEndsAtMs))
    }
    if (nowMs >= HEX_DROP.MAX_ROUND_MS) this.finish(null)

    if (nowMs - this.lastReportAtMs >= REPORT_INTERVAL_MS) {
      this.lastReportAtMs = nowMs
      const { x, y, z } = this.state
      this.callbacks.progress({ t: Math.round(nowMs), x: centi(x), y: centi(y), z: centi(z), out: this.state.out ? 1 : 0 })
    }
  }

  private reportTouch(tile: number, atMs: number): void {
    this.touched.add(tile)
    this.predicted.set(tile, atMs + HEX_DROP.FALL_DELAY_MS)
    this.callbacks
      .touch(tile, atMs)
      .then((reply) => {
        // The server's word on this touch: a slow report may have been taken as later.
        const { fallAtMs } = reply as TouchReply
        if (typeof fallAtMs === 'number') this.predicted.set(tile, fallAtMs)
      })
      .catch(() => undefined)
  }

  private finish(outAtMs: number | null): void {
    if (this.finished || !this.setup.isRunning) return
    this.finished = true
    // Everyone sees the final position, and that they are out.
    const { x, y, z } = this.state
    this.callbacks.progress({
      t: Math.round(Math.max(0, this.raceMs())),
      x: centi(x), y: centi(y), z: centi(z),
      out: outAtMs === null ? 0 : 1,
    })
    this.callbacks.finish(outAtMs)
  }

  private controls(): Controls {
    const has = (keys: Set<string>) => [...this.held].some((key) => keys.has(key))
    const axis = (negative: boolean, positive: boolean) => (negative === positive ? 0 : negative ? -1 : 1)
    const jump = this.jumpPressed
    this.jumpPressed = false
    // The stick, when it is pushed, steers precisely; otherwise the keys do.
    const controls =
      this.stick.x !== 0 || this.stick.z !== 0
        ? { moveX: this.stick.x, moveZ: this.stick.z, jump }
        : { moveX: axis(has(LEFT), has(RIGHT)), moveZ: axis(has(UP), has(DOWN)), jump }
    if (controls.moveX !== 0 || controls.moveZ !== 0) this.facing = { x: controls.moveX, z: controls.moveZ }
    return controls
  }

  private listenToKeys(): () => void {
    const isGameKey = (key: string) => [LEFT, RIGHT, UP, DOWN, JUMP].some((keys) => keys.has(key))
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || !isGameKey(event.key)) return
      event.preventDefault()
      if (JUMP.has(event.key) && !event.repeat) this.jumpPressed = true
      this.held.add(event.key)
    }
    const onKeyUp = (event: KeyboardEvent) => { this.held.delete(event.key) }
    // Letting go of the window lets go of every key, so nobody runs on by themselves.
    const onBlur = () => {
      this.held.clear()
      this.stick = { x: 0, z: 0 }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }

  /* ---------------- drawing ---------------- */

  private draw(): void {
    const nowMs = performance.now() - this.setup.timingStartsAtLocalMs
    const runners: RunnerPose[] = []

    if (this.setup.isRunning) {
      // Between the last two steps, one step behind, so the runner moves smoothly
      // on every display frame however its rate lines up with the steps.
      const sinceStepMs = nowMs - this.stepsDone * STEP_MS
      const alpha = this.finished || nowMs < 0 ? 1 : Math.min(1, Math.max(0, sinceStepMs / STEP_MS))
      const blend = (from: number, to: number) => from + (to - from) * alpha
      const { state, previous } = this
      runners.push({
        playerId: this.setup.selfPlayerId,
        x: blend(previous.x, state.x),
        y: blend(previous.y, state.y),
        z: blend(previous.z, state.z),
        vx: state.tile === null && state.vy !== 0 ? 0 : state.vx / 1000,
        vz: state.tile === null && state.vy !== 0 ? 0 : state.vz / 1000,
        layer: state.layer,
        facing: this.facing,
        isSelf: true,
        isOut: state.out,
        isWinner: this.winners.has(this.setup.selfPlayerId),
      })
    }

    for (const { playerId } of this.setup.players) {
      if (playerId === this.setup.selfPlayerId) continue
      const spawn = TILES[this.setup.spawns[playerId] ?? 0]!
      const point = this.tracks.get(playerId)?.at(nowMs - REMOTE_DELAY_MS)
      const height = point?.z ?? layerHeight(spawn.layer)
      runners.push({
        playerId,
        x: point?.x ?? spawn.x,
        y: height,
        z: point?.y ?? spawn.z,
        // Running legs only on the ground: in the air their height is changing.
        vx: point !== null && point !== undefined && point.vz === 0 ? point.vx : 0,
        vz: point !== null && point !== undefined && point.vz === 0 ? point.vy : 0,
        layer: Math.max(0, Math.min(LAYER_COUNT - 1, Math.round(LAYER_COUNT - 1 - height / HEX_DROP.LAYER_GAP))),
        isSelf: false,
        isOut: this.rivalsOut.has(playerId),
        isWinner: this.winners.has(playerId),
      })
    }

    const isFollowing = this.setup.isRunning && !this.state.out
    const self = runners[0]
    this.scene.render({
      nowMs,
      runners,
      fallAtMs: this.fallAtMs,
      focus: isFollowing && self !== undefined ? { x: self.x, y: self.y, z: self.z } : null,
    })
  }
}
