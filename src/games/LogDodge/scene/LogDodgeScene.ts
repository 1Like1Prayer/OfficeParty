import {
  AmbientLight,
  CanvasTexture,
  Clock,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three'
import { COUNTER_ACTION, LOG_DODGE } from '../../../shared/games/logDodge/constants.ts'
import type { Action, Log } from '../../../shared/games/logDodge/types.ts'
import type { RoundPlayerView } from '../../../types/index.ts'
import { createAvatarTexture } from '../../three/avatarTexture.ts'
import { labelWidthFor } from '../../three/Nameplate.ts'
import { followPose, overviewPose, zoomProgress } from './cameraPath.ts'
import { Contestant } from './Contestant.ts'
import { HEARTS_TAG_ASPECT, HeartsTag } from '../../three/HeartsTag.ts'
import { Ocean } from './Ocean.ts'
import { RollingLog, LogShared } from './RollingLog.ts'
import { Sky } from './Sky.ts'
import {
  BELT_MARGIN,
  CAMERA,
  CAMERA_FIELD_OF_VIEW,
  CONTACT_GRACE_MS,
  HORIZON_COLOR,
  LANE_CLOSE,
  LANE_SPACING,
  LOG,
  OVERVIEW_NEIGHBOURS,
} from './sceneConfig.ts'
import { Treadmill } from './Treadmill.ts'

/** How a contestant is doing, as the screen knows it. */
export interface ContestantStatus {
  /** Hits taken so far. */
  hits: number
  /** Knocked out, and on their way off the belt. */
  isOut: boolean
  /**
   * Their latest press, `atMs` into the round, so this screen can play it.
   * Null for the player themselves, whose presses reach the scene directly
   * through `press`, and for anyone who has not pressed yet.
   */
  lastPress: { action: Action; atMs: number } | null
}

export interface StageStatus {
  byPlayerId: ReadonlyMap<string, ContestantStatus>
  /** The player's own round is over, whether they were knocked out or lasted. */
  selfEnded: boolean
  /** Only one player (or none) is left standing, or the server has ranked the round: no more logs. */
  isRoundOver: boolean
  /** Who is still standing once the server has decided the round, or null until then. */
  survivorIds: ReadonlySet<string> | null
}

interface RoundSetup {
  logs: readonly Log[]
  /** `performance.now()` value at which the round's clock reads zero. */
  timingStartsAtLocalMs: number
  selfPlayerId: string
}

interface LabelLayout {
  /** The tag's width, in screen-sized sprite units. */
  width: number
  /** How far the back row of tags sits from the front row, in world units; 0 for a single row. */
  rowOffset: number
}

interface Entry {
  player: RoundPlayerView
  /** Where they are across the belt right now; eases toward their lane as the lanes close up. */
  x: number
  /** Their lane among those still on the belt, left to right. */
  lane: number
  /** Which of the two tag rows they belong in, 0 or 1. */
  row: number
  /** Where their tag is between the rows, easing to `row` when it changes. */
  tagRow: number
  /** Their tag fades once they are out, so it does not sit over whoever closes up into their lane. */
  tagOpacity: number
  contestant: Contestant
  nameplate: HeartsTag
  badge: CanvasTexture
  /** Hits already shown, so a new one is only reacted to once. */
  shownHits: number
  /** The next log whose contact has yet to be checked. */
  nextContact: number
  /** Logs this contestant has dodged so far, by index, as far as this screen has seen. */
  dodged: Set<number>
  /** When the last press played for this contestant was made, so each one plays once. */
  playedPressAtMs: number
}

/** The widest a name tag is drawn, in screen pixels, and the narrowest it is allowed to shrink to. */
const NAMEPLATE_PIXELS = 150
const NAMEPLATE_MIN_PIXELS = 84
const NAMEPLATE_HEIGHT = 2.75

/**
 * Another player's press reaches this screen a little after they made it. One
 * older than this is not played: it is from before this screen joined, or so
 * late that the log it answered has already gone by.
 */
const STALE_PRESS_MS = 600

/** How fast a knocked-out runner's tag fades away, so it is gone in about a second. */
const TAG_FADE_PER_SECOND = 3.5
/** How fast a tag moves to its new row when the lanes close up. */
const TAG_ROW_PER_SECOND = 7

/** How long the logs still on their way take to fade once the round is decided. */
const LOG_STOP_FADE_MS = 450

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount

/**
 * The 3D stage: a giant treadmill out over a sunny sea, a row of contestants
 * running on it, and logs rolling in from the far end.
 *
 * React owns the round; this class only draws it. The camera opens high above
 * everyone and swoops in behind the player. Each log is placed purely from
 * the round's clock, so the picture is the schedule and nothing here decides
 * who got hit — the server does that. The player's own dodges are drawn from
 * their presses as they make them; everyone else's from the presses they
 * report, a moment later, and they react when the hits they report go up.
 */
export class LogDodgeScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(CAMERA_FIELD_OF_VIEW, 1, 0.3, 400)
  private readonly clock = new Clock()
  private readonly treadmill = new Treadmill()
  private readonly sky = new Sky()
  private readonly ocean = new Ocean()
  private readonly sharedLog = new LogShared()
  private readonly logs: RollingLog[]
  private readonly sun = new DirectionalLight(0xfff3d6, 2.6)
  private readonly resizeObserver: ResizeObserver
  private readonly round: RoundSetup

  private entries: Entry[] = []
  private status: StageStatus = { byPlayerId: new Map(), selfEnded: false, isRoundOver: false, survivorIds: null }
  /**
   * How name tags are sized in each of the camera's two views. With a crowded
   * field they alternate between two rows so neighbours never touch: in the
   * overhead shot the back row sits further up the belt, and down behind the
   * player, where depth hardly shows, it sits higher up instead.
   */
  private labelLayout: Record<'overview' | 'follow', LabelLayout> = {
    overview: { width: 1, rowOffset: 0 },
    follow: { width: 1, rowOffset: 0 },
  }
  /** The belt's width as drawn, easing toward `targetBeltWidth` as runners drop out. */
  private beltWidth = 1
  private targetBeltWidth = 1
  /** How many are still on the belt, so the layout is only re-planned when that changes. */
  private onBeltCount = -1
  private elapsedSeconds = 0
  /** The moment, in ms into the round, the screen found out the round was decided. */
  private stoppedAtMs: number | null = null
  private cameraBlend = 0
  private shake = 0
  private readonly cameraPosition = new Vector3()
  private readonly cameraTarget = new Vector3()

  constructor(host: HTMLElement, round: RoundSetup) {
    this.round = round
    this.renderer = new WebGLRenderer({ antialias: true })
    // This stage fills the screen with lit, shadowed, fogged surface, so it is capped
    // below the 2x the lighter games allow: on a high-density display that is a quarter fewer pixels.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    // Out of the layout flow, so a stale canvas size can never force the page wider.
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0' })
    host.appendChild(this.renderer.domElement)

    // The sea and sky both fade to the same haze, so the horizon has no seam.
    this.scene.fog = new Fog(HORIZON_COLOR, 70, 230)
    this.addLights()
    this.scene.add(this.sky.group, this.ocean.mesh, this.treadmill.group)

    this.logs = round.logs.map((log) => {
      const rolling = new RollingLog(log.height, this.sharedLog)
      this.scene.add(rolling.group)
      return rolling
    })

    this.resizeObserver = new ResizeObserver(() => { this.resize(host) })
    this.resizeObserver.observe(host)
    this.resize(host)
    this.renderer.setAnimationLoop(() => { this.renderFrame() })
  }

  /** Who is on the belt, left to right. Call again if the field changes. */
  setRoster(players: readonly RoundPlayerView[]): void {
    for (const entry of this.entries) this.removeEntry(entry)

    const count = players.length
    const slotXs = players.map((_, index) => (index - (count - 1) / 2) * LANE_SPACING)
    const width = beltWidthFor(count)
    this.beltWidth = width
    this.targetBeltWidth = width
    this.onBeltCount = -1
    // The belt only ever narrows from here, so the shadows are sized for it at its widest.
    this.sun.shadow.camera.left = -(width / 2 + 4)
    this.sun.shadow.camera.right = width / 2 + 4
    this.sun.shadow.camera.updateProjectionMatrix()

    const startMs = performance.now() - this.round.timingStartsAtLocalMs
    this.entries = players.map((player, index) => {
      const badge = createAvatarTexture({
        initial: player.initial,
        color: player.color,
        seed: player.avatar,
      })
      const contestant = new Contestant(player.color, badge)
      contestant.root.position.set(slotXs[index]!, 0, 0)
      const nameplate = new HeartsTag(LOG_DODGE.MAX_HITS)
      this.scene.add(contestant.root, nameplate.sprite)

      // A screen that joins the round part-way starts from where it has got to.
      const passed = this.round.logs.findIndex((log) => log.arriveAtMs > startMs)
      const next = passed === -1 ? this.round.logs.length : passed
      return {
        player,
        x: slotXs[index]!,
        lane: index,
        row: index % 2,
        tagRow: index % 2,
        tagOpacity: 1,
        contestant,
        nameplate,
        badge,
        shownHits: 0,
        nextContact: next,
        dodged: new Set<number>(),
        playedPressAtMs: Number.NEGATIVE_INFINITY,
      }
    })
    this.updateLayout(0)
  }

  /** The latest standings. Cheap to call on every React render. */
  setStatus(status: StageStatus): void {
    this.status = status
  }

  /**
   * The player pressed an action. It plays straight away, held long enough
   * to still be in force when the log it answers arrives.
   */
  press(action: Action, atMs: number): void {
    const self = this.entries.find(({ player }) => player.playerId === this.round.selfPlayerId)
    if (!self) return
    this.playPress(self, action, atMs, atMs)
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    for (const entry of this.entries) this.removeEntry(entry)
    this.logs.forEach((log) => { log.dispose() })
    this.sharedLog.dispose()
    this.treadmill.dispose()
    this.sky.dispose()
    this.ocean.dispose()
    this.scene.traverse(disposeObject)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  /* ---------------- frame ---------------- */

  private renderFrame(): void {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05)
    const nowMs = performance.now() - this.round.timingStartsAtLocalMs

    this.elapsedSeconds += deltaSeconds
    if (this.status.isRoundOver && this.stoppedAtMs === null) this.stoppedAtMs = nowMs
    this.treadmill.update(deltaSeconds)
    this.ocean.update(this.elapsedSeconds)
    this.updateLayout(deltaSeconds)
    this.updateLogs(nowMs)
    for (const entry of this.entries) {
      this.updateEntry(entry, nowMs)
      entry.contestant.update(deltaSeconds)
    }
    this.updateCamera(nowMs, deltaSeconds)
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Closes the lanes up behind anyone knocked out: those still running step
   * sideways into the gap and the belt narrows under them, so the field stays
   * shoulder to shoulder however many are left.
   */
  private updateLayout(deltaSeconds: number): void {
    const onBelt = this.entries.filter(({ contestant }) => !contestant.isOut)
    const count = onBelt.length
    if (count !== this.onBeltCount) {
      this.onBeltCount = count
      this.targetBeltWidth = beltWidthFor(count)
      for (const [lane, entry] of onBelt.entries()) entry.lane = lane
      // Closing a gap puts two same-row tags side by side, so one side of it has to swap
      // rows: whichever side moves fewer tags.
      const moves = (shift: number) => onBelt.filter((entry) => (entry.lane + shift) % 2 !== entry.row).length
      const shift = moves(0) <= moves(1) ? 0 : 1
      for (const entry of onBelt) entry.row = (entry.lane + shift) % 2
      this.sizeLabels()
    }

    const ease = 1 - Math.exp(-LANE_CLOSE.RESPONSE_PER_SECOND * deltaSeconds)
    const maxStep = LANE_CLOSE.MAX_SPEED * deltaSeconds
    const approach = (from: number, to: number, limit: number): number =>
      from + Math.max(-limit, Math.min(limit, (to - from) * ease))

    for (const [lane, entry] of onBelt.entries()) {
      entry.x = approach(entry.x, (lane - (count - 1) / 2) * LANE_SPACING, maxStep)
      entry.contestant.root.position.x = entry.x
      // With a crowded field the tags alternate rows; one whose lane changes drifts to its new row.
      // Quicker than the sidestep, so a tag has changed rows before its neighbour arrives.
      entry.tagRow += (entry.row - entry.tagRow) * (1 - Math.exp(-TAG_ROW_PER_SECOND * deltaSeconds))
    }
    // Both edges come in, so the width can close twice as fast as any one runner moves.
    this.beltWidth = approach(this.beltWidth, this.targetBeltWidth, maxStep * 2)

    // An "OUT" tag is shown for a moment, then fades as the others close up over it.
    const fade = 1 - Math.exp(-TAG_FADE_PER_SECOND * deltaSeconds)
    for (const entry of this.entries) {
      if (entry.contestant.isOut) entry.tagOpacity += (0 - entry.tagOpacity) * fade
    }

    const dividers: number[] = []
    for (let index = 1; index < count; index++) dividers.push((onBelt[index - 1]!.x + onBelt[index]!.x) / 2)
    this.treadmill.setLayout(dividers, this.beltWidth)
    for (const log of this.logs) log.setSpan(this.beltWidth)
  }

  private updateLogs(nowMs: number): void {
    for (const [index, log] of this.round.logs.entries()) {
      const rolling = this.logs[index]!
      const progress = (nowMs - (log.arriveAtMs - log.travelMs)) / log.travelMs
      // Spawned at the far end, it keeps the same speed on through the contestants and off the near end.
      const z = LOG.SPAWN_Z * (1 - progress)
      if (progress < 0 || z > LOG.GONE_Z) {
        rolling.hide()
        continue
      }

      // Once the round is decided the logs stop coming: any that had not yet reached the
      // contestants melt away rather than rolling on into a finished round.
      const stoppedAt = this.stoppedAtMs
      const cutOff =
        stoppedAt !== null && log.arriveAtMs > stoppedAt
          ? Math.max(0, 1 - (nowMs - stoppedAt) / LOG_STOP_FADE_MS)
          : 1

      if (cutOff <= 0) {
        rolling.hide()
        continue
      }
      rolling.place({
        z,
        // Swung round on the way in, square-on by the time it gets there.
        tilt: (log.angleDeg * Math.PI * Math.pow(1 - Math.min(1, progress), 2)) / 180,
        fade: Math.min(1, progress / LOG.FADE_IN) * cutOff,
      })
    }
  }

  /**
   * Plays a press made `atMs` into the round, now that it is `nowMs`. The log
   * it answers is found by the same rule the server judges by: the earliest
   * undodged log of the right height whose window holds the press. The move is
   * held so it is still in force when that log arrives, which for another
   * player's press, arriving late, is sooner than it was for them.
   */
  private playPress(entry: Entry, action: Action, atMs: number, nowMs: number): void {
    const index = this.round.logs.findIndex(
      (log, i) =>
        !entry.dodged.has(i) &&
        COUNTER_ACTION[log.height] === action &&
        Math.abs(atMs - log.arriveAtMs) <= LOG_DODGE.HIT_WINDOW_MS,
    )
    if (index !== -1) entry.dodged.add(index)

    const untilArrivalMs = index === -1 ? 0 : this.round.logs[index]!.arriveAtMs - nowMs
    entry.contestant.perform(action, holdFor(action, untilArrivalMs))
  }

  private updateEntry(entry: Entry, nowMs: number): void {
    const { player, contestant, nameplate } = entry
    const isSelf = player.playerId === this.round.selfPlayerId
    const state = this.status.byPlayerId.get(player.playerId) ?? { hits: 0, isOut: false, lastPress: null }
    const logs = this.round.logs

    if (state.isOut) contestant.knockOut()
    else if (this.status.survivorIds?.has(player.playerId)) contestant.celebrate()

    if (isSelf) {
      // A log that has reached the player with nothing dodging it has hit them.
      while (entry.nextContact < logs.length && nowMs >= logs[entry.nextContact]!.arriveAtMs + CONTACT_GRACE_MS) {
        const isCutOff = this.stoppedAtMs !== null && logs[entry.nextContact]!.arriveAtMs > this.stoppedAtMs
        // The last one standing has won: nothing touches them any more.
        const hasWon = this.status.survivorIds?.has(player.playerId) === true
        if (!entry.dodged.has(entry.nextContact) && !contestant.isOut && !isCutOff && !hasWon) {
          contestant.zap()
          this.shake = 1
        }
        entry.nextContact++
      }
    } else {
      // Everyone else's presses arrive in their reports, a moment after they
      // made them, and play as soon as they do.
      const press = state.lastPress
      if (press !== null && press.atMs > entry.playedPressAtMs) {
        entry.playedPressAtMs = press.atMs
        if (nowMs - press.atMs <= STALE_PRESS_MS) this.playPress(entry, press.action, press.atMs, nowMs)
      }
      // Their own judging decides whether a log hit them; their report says so.
      if (state.hits > entry.shownHits) contestant.zap()
    }
    entry.shownHits = Math.max(entry.shownHits, state.hits)

    // The tag floats above the contestant and is left behind when they are thrown off.
    nameplate.sprite.visible = !contestant.hasLeft
    // Sized and stacked for whichever view the camera is in, or between them on the swoop.
    const blend = this.cameraBlend
    const { overview, follow } = this.labelLayout
    nameplate.setWidth(lerp(overview.width, follow.width, blend))
    // Out of the way once the camera is down behind the player, who can see their own lives in the HUD.
    nameplate.setOpacity((isSelf ? 1 - this.cameraBlend : 1) * entry.tagOpacity)
    nameplate.sprite.position.set(
      entry.x,
      NAMEPLATE_HEIGHT + entry.tagRow * follow.rowOffset * blend,
      -1.2 - entry.tagRow * overview.rowOffset * (1 - blend),
    )
    nameplate.update({
      name: player.name,
      lives: Math.max(0, LOG_DODGE.MAX_HITS - state.hits),
      isYou: isSelf,
      isOut: state.isOut,
    })
  }

  private updateCamera(nowMs: number, deltaSeconds: number): void {
    const self = this.entries.find(({ player }) => player.playerId === this.round.selfPlayerId)

    // The opening swoop is a function of the clock; afterwards, once the
    // player is out or it is over, the camera rises back to take in the field.
    const scheduled = self ? zoomProgress(nowMs) : 0
    if (this.status.selfEnded || !self) {
      this.cameraBlend += (0 - this.cameraBlend) * (1 - Math.exp(-2.2 * deltaSeconds))
    } else {
      this.cameraBlend = scheduled
    }

    const frame = this.overviewFrame(this.beltWidth, self)
    const overview = overviewPose(frame.halfWidth, this.camera.fov, this.camera.aspect, frame.centerX)
    const follow = followPose(self?.x ?? 0)
    const blend = this.cameraBlend
    this.cameraPosition.set(
      lerp(overview.position[0], follow.position[0], blend),
      lerp(overview.position[1], follow.position[1], blend),
      lerp(overview.position[2], follow.position[2], blend),
    )
    this.cameraTarget.set(
      lerp(overview.target[0], follow.target[0], blend),
      lerp(overview.target[1], follow.target[1], blend),
      lerp(overview.target[2], follow.target[2], blend),
    )

    // A hit rattles the camera, and the rattle dies away.
    this.shake = Math.max(0, this.shake - CAMERA.SHAKE_DECAY_PER_SECOND * deltaSeconds)
    const rattle = this.shake * CAMERA.SHAKE_STRENGTH * blend
    this.camera.position.set(
      this.cameraPosition.x + (Math.random() - 0.5) * rattle,
      this.cameraPosition.y + (Math.random() - 0.5) * rattle,
      this.cameraPosition.z,
    )
    this.camera.lookAt(this.cameraTarget)
    this.sky.follow(this.camera.position)
  }

  /* ---------------- set-up ---------------- */

  private addLights(): void {
    // Bright sky light from above, warm bounce off the sea from below.
    this.scene.add(new HemisphereLight(0xcfe9ff, 0x4aa6c9, 1.35), new AmbientLight(0xffffff, 0.35))

    this.sun.position.set(8, 26, 16)
    this.sun.target.position.set(0, 0, -4)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -20, right: 20, top: 24, bottom: -24, near: 1, far: 80 })
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    this.scene.add(this.sun, this.sun.target)
  }

  /**
   * Name tags are a fixed size on screen, so they read the same from overhead
   * and up close. Sized for the overview, where everyone is in view at once:
   * if a lane is narrower than a tag, the tags shrink a little and alternate
   * between two rows, so even a full room of twelve never overlaps.
   */
  private sizeLabels(): void {
    const canvasHeight = this.renderer.domElement.clientHeight || 1
    const self = this.entries.find(({ player }) => player.playerId === this.round.selfPlayerId)
    const { halfWidth } = this.overviewFrame(this.targetBeltWidth, self)
    const pose = overviewPose(halfWidth, CAMERA_FIELD_OF_VIEW, this.camera.aspect)
    const overviewDistance = Math.hypot(pose.position[1], pose.position[2] - pose.target[2])
    const followDistance = Math.hypot(CAMERA.FOLLOW_HEIGHT - NAMEPLATE_HEIGHT, CAMERA.FOLLOW_BEHIND + 1.2)
    const isCrowded = this.entries.length > 1
    this.labelLayout = {
      overview: this.layoutLabels(overviewDistance, canvasHeight, isCrowded),
      follow: this.layoutLabels(followDistance, canvasHeight, isCrowded),
    }
  }

  /** Tag size, and the step between rows, for a camera `distance` from the tags. */
  private layoutLabels(distance: number, canvasHeight: number, isCrowded: boolean): LabelLayout {
    const pixelsPerUnit = canvasHeight / 2 / (Math.tan((CAMERA_FIELD_OF_VIEW * Math.PI) / 360) * distance)
    const lanePixels = LANE_SPACING * pixelsPerUnit
    let pixels = NAMEPLATE_PIXELS
    let rowOffset = 0
    if (isCrowded && lanePixels * 0.94 < NAMEPLATE_PIXELS) {
      pixels = Math.min(NAMEPLATE_PIXELS, Math.max(NAMEPLATE_MIN_PIXELS, lanePixels * 1.85))
      // A tag's height, as a share of its width, in world units at this distance.
      rowOffset = ((pixels * HEARTS_TAG_ASPECT) / pixelsPerUnit) * 1.08
    }
    return { width: labelWidthFor(pixels, canvasHeight, CAMERA_FIELD_OF_VIEW), rowOffset }
  }

  /**
   * What the wide shot takes in. A player sees themselves and their nearest
   * neighbours, slid inward at the ends so it never frames empty sea; a
   * spectator, with no place of their own, sees the whole belt.
   */
  private overviewFrame(beltWidth: number, self: Entry | undefined): { halfWidth: number; centerX: number } {
    const beltHalf = beltWidth / 2 + 1
    if (!self) return { halfWidth: beltHalf, centerX: 0 }
    const neighbours = this.camera.aspect < 1 ? OVERVIEW_NEIGHBOURS.PORTRAIT : OVERVIEW_NEIGHBOURS.LANDSCAPE
    const halfWidth = Math.min(beltHalf, beltWidthFor(neighbours * 2 + 1) / 2 + 1)
    const room = beltHalf - halfWidth
    return { halfWidth, centerX: Math.max(-room, Math.min(room, self.x)) }
  }

  private resize(host: HTMLElement): void {
    const { clientWidth: width, clientHeight: height } = host
    if (width === 0 || height === 0) return
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.fov = CAMERA_FIELD_OF_VIEW
    this.camera.updateProjectionMatrix()
    this.sizeLabels()
  }

  private removeEntry(entry: Entry): void {
    this.scene.remove(entry.contestant.root, entry.nameplate.sprite)
    entry.contestant.dispose()
    entry.nameplate.dispose()
    entry.badge.dispose()
  }
}

/** The belt for `lanes` runners, with bare margin either side. */
function beltWidthFor(lanes: number): number {
  return Math.max(1, lanes) * LANE_SPACING + BELT_MARGIN * 2
}

/**
 * How long a move is held so it is still in force when the log lands.
 * `untilArrivalMs` is how long after the move starts the log arrives; zero
 * or negative (a late press, or one that dodged nothing) gets a short default.
 */
function holdFor(action: Action, untilArrivalMs: number): number {
  const untilArrival = Math.max(0, untilArrivalMs) / 1000
  if (action === 'jump') {
    // The apex of the jump falls on the log: twice the time to get there.
    return Math.min(1.3, Math.max(0.58, untilArrival * 2 + 0.1))
  }
  // Held until just after the log has passed.
  return Math.min(1.1, Math.max(0.3, untilArrival + 0.22))
}

function disposeObject(object: Object3D): void {
  const mesh = object as Partial<{ geometry: { dispose: () => void }; material: unknown }>
  mesh.geometry?.dispose()
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const material of materials as ({ dispose?: () => void } | undefined)[]) material?.dispose?.()
}
