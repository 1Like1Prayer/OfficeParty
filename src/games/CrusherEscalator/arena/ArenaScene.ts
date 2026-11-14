import {
  AmbientLight,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type CanvasTexture,
} from 'three'
import type { RoundPlayerView } from '../../../types/index.ts'
import { createAvatarTexture } from '../../three/avatarTexture.ts'
import {
  BACKGROUND_COLOR,
  CAMERA_FIELD_OF_VIEW,
  CHANGEOVER,
  changeoverArrival,
  type ArrivalScript,
  HOLE_DEPTH,
  LANE_WIDTH,
  MAX_VISIBLE_LANES,
  RUNNER_SCALE,
  RUNNER_START_DISTANCE,
  layoutFor,
  type ArenaLayout,
} from './arenaConfig.ts'
import { BlackHoleMesh } from './BlackHoleMesh.ts'
import { Starfield } from './Starfield.ts'
import { EscalatorRamp } from './EscalatorRamp.ts'
import { RunnerFigure } from './RunnerFigure.ts'
import { SCORE_TAG_ASPECT, ScoreTag } from '../../three/ScoreTag.ts'
import { Tweener } from '../../three/tweens.ts'
import type { LaneView } from './types.ts'

interface Lane {
  player: RoundPlayerView
  ramp: EscalatorRamp
  runner: RunnerFigure
  nameplate: ScoreTag
  badge: CanvasTexture
  /** Where a reflow is sliding this lane to, with its runner riding along; null once there. */
  slideTo: { x: number; scale: number } | null
  /** A neighbour come into view mid-race, waiting in the dark for the others to close up before rising. */
  isWaitingToRise: boolean
}

/**
 * How the line-up changes. A `changeover` (a fresh attempt) lifts every runner
 * on a beam and sets them down in their new places. A `reflow` (mid-race, as
 * runners are swallowed and neighbours come into view) just slides the
 * escalators sideways to close up, with the runners riding along.
 */
export type RosterChange = 'changeover' | 'reflow'

/** How quickly a reflowing escalator eases into its new place, and the fastest it slides, in units a second. */
const REFLOW_RESPONSE_PER_SECOND = 2.6
const REFLOW_MAX_SPEED = 9
/**
 * A neighbour coming into view mid-race rises into their place once the others
 * are nearly settled — within this far of where they are going — so nobody is
 * still standing there. Their runner is lowered on as the escalator lands.
 */
const REFLOW_SETTLED_DISTANCE = 1.2
const REFLOW_RISE_SECONDS = 0.8
const REFLOW_DROP_DELAY = 0.7
/** Long enough to mean "not until told": a waiting newcomer's runner stays out of sight. */
const HIDDEN_UNTIL_TOLD = 1e9

/** A lane on its way off the screen: waiting for its runner to go, then sinking. */
interface LeavingLane {
  lane: Lane
  secondsWaited: number
  isSinking: boolean
}

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount

/** A name tag takes this share of the gap between lanes; the rest is air between tags. */
const LABEL_SHARE_OF_GAP = 0.92
const MAX_LABEL_PIXELS = 260
const MIN_LABEL_PIXELS = 80


/** The sprite scale that draws a screen-sized sprite `pixels` wide, for a canvas this tall. */
const labelWidthFor = (pixels: number, canvasHeight: number, fieldOfViewDegrees: number): number =>
  (pixels * 2 * Math.tan((fieldOfViewDegrees * Math.PI) / 360)) / canvasHeight

/** How far above a runner's feet their name tag floats. */
const NAMEPLATE_HEIGHT = 3.4

/** How high the camera sits, as an angle above the horizon. */
const CAMERA_ELEVATION = 0.34
const MIN_CAMERA_DISTANCE = 12
const MAX_CAMERA_DISTANCE = 240
const CAMERA_FIT_STEP = 0.5
const FIT_PASSES = 4
/** Refits allowed while making room for a second row of tags; each settles closer. */
const LABEL_FIT_ATTEMPTS = 3
/** Anything framed must land inside this fraction of the screen; the rest is breathing room. */
const FRAMING_LIMIT = 0.92
/** The hole's glow fades out toward its rim; this much of the radius is the part worth framing. */
const VISIBLE_HOLE_FRACTION = 0.62
/** How far above the runners' starting spot the framing reaches. */
const FRAMED_DISTANCE_PAST_START = 3

/**
 * The 3D arena: a row of 30° escalators climbing away from the camera, one
 * runner on each, and a single black hole below their lower ends.
 *
 * React owns the race; this class only draws it. Tell it who is on the
 * escalators with `setRoster` — the first call builds the scene, later calls
 * play the changeover, lifting runners and setting them down in their new
 * places — and feed it the latest lane views with `setLanes`.
 */
export class ArenaScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(CAMERA_FIELD_OF_VIEW, 1, 0.5, 900)
  private readonly clock = new Clock()
  private readonly blackHole: BlackHoleMesh
  private readonly starfield: Starfield
  private readonly tweens = new Tweener()
  private lanes: Lane[] = []
  private leavingLanes: LeavingLane[] = []
  private readonly resizeObserver: ResizeObserver
  /** Where the camera wants to be; the camera itself eases toward it. */
  private readonly cameraGoal = new Vector3()
  private readonly cameraTargetGoal = new Vector3()
  private readonly cameraRest = new Vector3()
  private readonly cameraTarget = new Vector3()
  private shouldSnapCamera = true
  private layout: ArenaLayout = layoutFor(0)
  private isRacing = false
  private elapsedSeconds = 0
  /** How visible every name tag is: out for a changeover, then faded back in. */
  private labelOpacity = 1
  /** The width every name tag is drawn at, set so they never touch. */
  private labelWidth = 1
  /**
   * When lanes are too narrow for tags side by side, every other lane's tag
   * floats this much higher (world units), so neighbours stack instead of colliding.
   */
  private labelRowOffset = 0
  /** Extra headroom the framing leaves above the runners, for the score over each tag and any upper row. */
  private framingLift = 0
  /** How far a tag (its score above the pill) reaches above where it is anchored, in world units. */
  private labelHeadroom = 0

  constructor(host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    // Out of the layout flow, so a stale canvas size can never force the page wider.
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0' })
    host.appendChild(this.renderer.domElement)

    this.scene.background = new Color(BACKGROUND_COLOR)
    this.scene.fog = new Fog(BACKGROUND_COLOR, 38, 120)
    this.addLights()
    this.starfield = new Starfield()
    this.scene.add(this.starfield.group)

    // Built at the size a full row of lanes needs; scaled down for fewer.
    const widest = layoutFor(MAX_VISIBLE_LANES).hole
    this.blackHole = new BlackHoleMesh(widest.radius, widest.radius, widest.centerZ)
    this.scene.add(this.blackHole.group)

    this.resizeObserver = new ResizeObserver(() => { this.resize(host) })
    this.resizeObserver.observe(host)
    this.resize(host)
    this.renderer.setAnimationLoop(() => { this.renderFrame() })
  }

  /**
   * Who is on the escalators, in lane order. The first call builds them. After
   * that the changeover plays: runners who stay are lifted on a beam and set
   * down in their new lanes, escalators slide into the new order, new ones
   * rise out of the dark with their runners lowered onto them, and any
   * escalator with nobody going on sinks away.
   */
  setRoster(players: readonly RoundPlayerView[], change: RosterChange = 'changeover'): void {
    const isFirst = this.lanes.length === 0 && this.leavingLanes.length === 0
    const isReflow = change === 'reflow' && !isFirst
    const layout = layoutFor(players.length)
    const previous = new Map(this.lanes.map((lane) => [lane.player.playerId, lane]))
    const next: Lane[] = []

    players.forEach((player, index) => {
      const centerX = layout.slotXs[index]!
      const existing = previous.get(player.playerId)
      previous.delete(player.playerId)

      if (existing === undefined) {
        // On the first roster the lanes are simply there; later ones arrive
        // as part of the changeover.
        const lane = this.createLane(player, centerX, layout.laneScale, isFirst || isReflow ? null : changeoverArrival())
        if (isReflow) {
          // Down in the dark, out of sight, until the others have made room.
          lane.ramp.setHeightOffset(-CHANGEOVER.RISE_DEPTH)
          lane.runner.dropIn(HIDDEN_UNTIL_TOLD)
          lane.isWaitingToRise = true
        }
        next.push(lane)
      } else if (isReflow) {
        existing.slideTo = { x: centerX, scale: layout.laneScale }
        next.push(existing)
      } else {
        existing.slideTo = null
        this.relocateLane(existing, centerX, layout.laneScale, (index - (players.length - 1) / 2) * CHANGEOVER.WEAVE_SPACING)
        next.push(existing)
      }
    })
    for (const leaving of previous.values()) this.retireLane(leaving, !isReflow)

    this.lanes = next
    this.layout = layout
    // A reflow keeps the tags up: everyone stays on their feet, just shuffling sideways.
    if (!isFirst && !isReflow) this.hideLabels(CHANGEOVER.LABELS_RETURN_DELAY, CHANGEOVER.LABELS_FADE_DURATION)
    this.blackHole.setSize(layout.hole.radius, layout.hole.centerZ, isFirst)
    this.fitCamera()
    if (isFirst) this.snapCamera()
  }

  /** Tags would only be in the way of the lifting and carrying, so they leave and come back after. */
  private hideLabels(returnDelay: number, fadeDuration: number): void {
    this.labelOpacity = 0
    this.tweens.add(returnDelay, fadeDuration, (progress) => {
      this.labelOpacity = progress
    })
  }

  /** The latest state of every lane. Cheap to call on every React render. */
  setLanes(views: readonly LaneView[], isRacing: boolean): void {
    this.isRacing = isRacing
    let mostEndangered = 0

    for (const view of views) {
      const lane = this.lanes.find(({ player }) => player.playerId === view.playerId)
      if (!lane) continue

      lane.runner.setSlip(view.slip)
      if (view.isFallen) lane.runner.fall()
      else if (view.isWinner === true) lane.runner.celebrate()
      // A swallowed runner leaves an empty escalator that keeps running.
      lane.ramp.setPowered(isRacing)
      // Just the score and the name: where the runners stand shows who is ahead.
      lane.nameplate.update({ name: lane.player.name, score: String(view.score), isYou: view.isYou })
      if (!view.isFallen) mostEndangered = Math.max(mostEndangered, view.slip)
    }
    this.blackHole.setHunger(mostEndangered)
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.tweens.clear()
    for (const lane of [...this.lanes, ...this.leavingLanes.map(({ lane }) => lane)]) {
      this.removeLane(lane)
    }
    this.blackHole.dispose()
    this.starfield.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private renderFrame(): void {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05)
    this.elapsedSeconds += deltaSeconds

    this.tweens.update(deltaSeconds)
    this.updateSlides(deltaSeconds)
    for (const [index, { ramp, runner, nameplate }] of this.lanes.entries()) {
      ramp.update(deltaSeconds)
      runner.update(deltaSeconds, this.isRacing)
      // The tag rides above its runner, and is left behind when they fall.
      nameplate.sprite.visible = runner.isOnRamp && runner.root.visible
      nameplate.setOpacity(this.labelOpacity)
      nameplate.setWidth(this.labelWidth)
      nameplate.sprite.position.copy(runner.root.position).y +=
        NAMEPLATE_HEIGHT * runner.root.scale.y + (index % 2) * this.labelRowOffset
    }
    this.updateLeavingLanes(deltaSeconds)
    this.blackHole.update(deltaSeconds)
    this.starfield.update(this.elapsedSeconds)

    // A slow drift so the arena never looks like a photograph, and a tremor
    // when the hole is thrashing.
    const cameraEase = this.shouldSnapCamera ? 1 : 1 - Math.exp(-2.5 * deltaSeconds)
    this.shouldSnapCamera = false
    this.cameraRest.lerp(this.cameraGoal, cameraEase)
    this.cameraTarget.lerp(this.cameraTargetGoal, cameraEase)
    const tremor = this.blackHole.fury * 0.28
    this.camera.position.set(
      this.cameraRest.x + Math.sin(this.elapsedSeconds * 0.25) * 0.8 + (Math.random() - 0.5) * tremor,
      this.cameraRest.y + Math.sin(this.elapsedSeconds * 0.18) * 0.3 + (Math.random() - 0.5) * tremor,
      this.cameraRest.z,
    )
    this.camera.lookAt(this.cameraTarget)
    this.renderer.render(this.scene, this.camera)
  }

  /** Eases reflowing escalators into their new places; their runners ride along. */
  private updateSlides(deltaSeconds: number): void {
    // Nobody closes up over an escalator that is still standing in the gap.
    if (this.leavingLanes.some(({ isSinking }) => !isSinking)) return
    const ease = 1 - Math.exp(-REFLOW_RESPONSE_PER_SECOND * deltaSeconds)
    const maxStep = REFLOW_MAX_SPEED * deltaSeconds
    for (const lane of this.lanes) {
      const { slideTo, ramp, runner } = lane
      if (slideTo === null) continue
      const step = (slideTo.x - ramp.centerX) * ease
      const x = ramp.centerX + Math.max(-maxStep, Math.min(maxStep, step))
      const scale = lerp(ramp.laneScale, slideTo.scale, ease)
      const isThere = Math.abs(slideTo.x - x) < 0.01 && Math.abs(slideTo.scale - scale) < 0.001
      ramp.setLayout(isThere ? slideTo.x : x, isThere ? slideTo.scale : scale)
      runner.setBaseScale((isThere ? slideTo.scale : scale) * RUNNER_SCALE)
      if (isThere) lane.slideTo = null
    }

    // Once everyone is nearly in place, any newcomer rises into the room made for them.
    const isSettled = this.lanes.every(
      ({ slideTo, ramp }) => slideTo === null || Math.abs(slideTo.x - ramp.centerX) < REFLOW_SETTLED_DISTANCE,
    )
    if (!isSettled) return
    for (const lane of this.lanes) {
      if (!lane.isWaitingToRise) continue
      lane.isWaitingToRise = false
      const { ramp } = lane
      this.tweens.add(0, REFLOW_RISE_SECONDS, (progress) => {
        ramp.setHeightOffset(lerp(-CHANGEOVER.RISE_DEPTH, 0, progress))
      })
      lane.runner.dropIn(REFLOW_DROP_DELAY)
    }
  }

  private addLights(): void {
    this.scene.add(new HemisphereLight(0xb9b0ff, 0x1a0a30, 0.9), new AmbientLight(0x6a5aa0, 0.35))

    const sun = new DirectionalLight(0xfff1e0, 2.2)
    sun.position.set(8, 26, 16)
    sun.target.position.set(0, 6, -10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    // Wide enough for a full row of lanes, so the shadows never clip at the sides.
    const reach = 60
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: 26, bottom: -26, near: 1, far: 90 })
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.04
    this.scene.add(sun, sun.target)
  }

  /**
   * Places the camera so everything that matters is on screen at once: the
   * whole black hole, the lower end of every escalator, and the runners with
   * their name tags. It backs off only as far as that takes, so the scene is
   * as large as the window allows and nothing — least of all the hole — is
   * ever cropped, whatever the window's shape. Re-run on every resize.
   */
  private fitCamera(): void {
    // Tags stacked in two rows need headroom for the upper row, but how much
    // depends on how far back the camera ends up, so fit, measure, and refit.
    this.framingLift = 0
    for (let attempt = 0; attempt < LABEL_FIT_ATTEMPTS; attempt++) {
      this.fitOnce()
      const needed = this.labelRowOffset + this.labelHeadroom
      if (needed <= this.framingLift) break
      this.framingLift = needed
    }
  }

  private fitOnce(): void {
    const points = this.framingPoints()
    const center = new Box3().setFromPoints(points).getCenter(new Vector3())
    const viewDirection = new Vector3(0, Math.sin(CAMERA_ELEVATION), Math.cos(CAMERA_ELEVATION))
    const halfTan = Math.tan((this.camera.fov * Math.PI) / 360)

    // Perspective makes the near edge of the scene take more screen than the
    // far edge, so the box's middle is not the screen's middle. Fit, see how
    // lopsided the result is, nudge the aim to even it out, and fit again.
    for (let pass = 0; pass < FIT_PASSES; pass++) {
      const passDistance = this.closestFittingDistance(center, viewDirection, points)
      const [lowest, highest] = this.verticalExtent(points)
      const screenUp = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1)
      center.addScaledVector(screenUp, ((lowest + highest) / 2) * passDistance * halfTan)
    }
    const distance = this.closestFittingDistance(center, viewDirection, points)

    this.cameraGoal.copy(center).addScaledVector(viewDirection, distance)
    this.cameraTargetGoal.copy(center)
    this.sizeLabels(center, viewDirection, distance)
  }

  /**
   * Name tags are drawn at a fixed size on screen so they all read the same.
   * That size is as wide as the gap between two neighbouring lanes allows, at
   * the farthest point a runner reaches (where the gap is smallest), so tags
   * never touch however the runners are spread up the escalators.
   */
  private sizeLabels(center: Vector3, viewDirection: Vector3, distance: number): void {
    const { slotXs } = this.layout
    const canvasHeight = this.renderer.domElement.clientHeight
    this.labelRowOffset = 0
    const worldPerPixel = (2 * Math.tan((this.camera.fov * Math.PI) / 360) * distance) / (canvasHeight || 1)
    // The pill is centred on the anchor; above it is half the pill and the whole score row.
    const headroomFor = (pixels: number) => pixels * SCORE_TAG_ASPECT * 0.72 * worldPerPixel
    if (slotXs.length < 2 || canvasHeight === 0) {
      this.labelWidth = labelWidthFor(MAX_LABEL_PIXELS, canvasHeight || 1, this.camera.fov)
      this.labelHeadroom = headroomFor(MAX_LABEL_PIXELS)
      return
    }

    // Put the camera where it is about to be, to measure the gap as it will look.
    this.camera.position.copy(center).addScaledVector(viewDirection, distance)
    this.camera.lookAt(center)
    this.camera.updateMatrixWorld(true)

    const farthest = RUNNER_START_DISTANCE
    const left = EscalatorRamp.pointOn(slotXs[0]!, farthest, 0).project(this.camera)
    const right = EscalatorRamp.pointOn(slotXs[1]!, farthest, 0).project(this.camera)
    const gapPixels = Math.abs(right.x - left.x) * (this.renderer.domElement.clientWidth / 2)

    let pixels = Math.min(MAX_LABEL_PIXELS, Math.max(MIN_LABEL_PIXELS, gapPixels * LABEL_SHARE_OF_GAP))
    if (gapPixels * LABEL_SHARE_OF_GAP < MIN_LABEL_PIXELS) {
      // Too narrow to sit side by side at a readable size: alternate lanes go up a
      // row, so a tag has two lanes' width to itself.
      pixels = Math.min(MAX_LABEL_PIXELS, Math.max(MIN_LABEL_PIXELS, gapPixels * 1.7 * LABEL_SHARE_OF_GAP))
      // Measured where the runners are, up the escalators, not at the scene's middle.
      const runnerSpot = EscalatorRamp.pointOn(slotXs[0]!, farthest, NAMEPLATE_HEIGHT)
      const runnerWorldPerPixel =
        (2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.distanceTo(runnerSpot)) / canvasHeight
      this.labelRowOffset = pixels * SCORE_TAG_ASPECT * runnerWorldPerPixel * 1.15
    }
    this.labelWidth = labelWidthFor(pixels, canvasHeight, this.camera.fov)
    this.labelHeadroom = headroomFor(pixels)
  }

  /** Puts the camera at its goal at once, for the first frame and a resized window. */
  private snapCamera(): void {
    this.cameraRest.copy(this.cameraGoal)
    this.cameraTarget.copy(this.cameraTargetGoal)
  }

  /** Backs the camera off from `center` until every point is comfortably on screen. */
  private closestFittingDistance(
    center: Vector3,
    viewDirection: Vector3,
    points: readonly Vector3[],
  ): number {
    let distance = MIN_CAMERA_DISTANCE
    for (; distance < MAX_CAMERA_DISTANCE; distance += CAMERA_FIT_STEP) {
      this.camera.position.copy(center).addScaledVector(viewDirection, distance)
      this.camera.lookAt(center)
      this.camera.updateMatrixWorld(true)
      if (points.every((point) => this.isComfortablyOnScreen(point))) break
    }
    return distance
  }

  /** The lowest and highest screen heights (-1 to 1) the points reach. */
  private verticalExtent(points: readonly Vector3[]): [number, number] {
    const heights = points.map((point) => point.clone().project(this.camera).y)
    return [Math.min(...heights), Math.max(...heights)]
  }

  private isComfortablyOnScreen(point: Vector3): boolean {
    const { x, y } = point.clone().project(this.camera)
    return Math.abs(x) <= FRAMING_LIMIT && Math.abs(y) <= FRAMING_LIMIT
  }

  /**
   * The spots that have to stay in view, in world space, for the layout the
   * scene is heading to — not where things happen to be mid-changeover.
   */
  private framingPoints(): Vector3[] {
    const { hole, slotXs, laneScale } = this.layout
    const points: Vector3[] = []

    for (let step = 0; step < 12; step++) {
      const angle = (step / 12) * Math.PI * 2
      points.push(
        new Vector3(
          Math.cos(angle) * hole.radius * VISIBLE_HOLE_FRACTION,
          HOLE_DEPTH,
          hole.centerZ + Math.sin(angle) * hole.radius * VISIBLE_HOLE_FRACTION,
        ),
      )
    }
    const half = laneScale * LANE_WIDTH
    for (const centerX of slotXs) {
      for (const side of [-1, 1]) {
        const edge = new Vector3(side * half, 0, 0)
        points.push(EscalatorRamp.pointOn(centerX, 0).add(edge))
        points.push(
          EscalatorRamp.pointOn(
            centerX,
            RUNNER_START_DISTANCE + FRAMED_DISTANCE_PAST_START,
            NAMEPLATE_HEIGHT * laneScale * RUNNER_SCALE + 1 + this.framingLift,
          ).add(edge),
        )
      }
    }
    return points
  }

  /* ---------------- lanes ---------------- */

  private createLane(
    player: RoundPlayerView,
    centerX: number,
    laneScale: number,
    arrival: ArrivalScript | null,
  ): Lane {
    const ramp = new EscalatorRamp(centerX, player.color, LANE_WIDTH)
    ramp.setLayout(centerX, laneScale)
    const badge = createAvatarTexture({
      initial: player.initial,
      color: player.color,
      seed: player.avatar,
    })
    const runner = new RunnerFigure(
      ramp,
      this.blackHole.center,
      () => { this.blackHole.gulp() },
      player.color,
      badge,
      laneScale * RUNNER_SCALE,
    )
    const nameplate = new ScoreTag()
    this.scene.add(ramp.group, runner.root, nameplate.sprite)

    if (arrival !== null) {
      // Rises out of the dark, and its runner is lowered onto it once it is up.
      const { RISE_DEPTH } = CHANGEOVER
      ramp.setHeightOffset(-RISE_DEPTH)
      this.tweens.add(arrival.riseDelay, arrival.riseDuration, (progress) => {
        ramp.setHeightOffset(lerp(-RISE_DEPTH, 0, progress))
      })
      runner.dropIn(arrival.dropDelay)
    }
    return { player, ramp, runner, nameplate, badge, slideTo: null, isWaitingToRise: false }
  }

  /** A player who stays: their escalator slides to its new place and they are carried to it. */
  private relocateLane(lane: Lane, centerX: number, laneScale: number, weaveHeight: number): void {
    const { ramp, runner } = lane
    const { LIFT_DELAY, RAMP_MOVE_DELAY, RAMP_MOVE_DURATION, NEWCOMER_DROP_DELAY } = CHANGEOVER
    const fromX = ramp.centerX
    const fromScale = ramp.laneScale

    this.tweens.add(RAMP_MOVE_DELAY, RAMP_MOVE_DURATION, (progress) => {
      ramp.setLayout(lerp(fromX, centerX, progress), lerp(fromScale, laneScale, progress))
      // Up at its own height at the middle of the slide, and back down by the end.
      ramp.setHeightOffset(Math.sin(progress * Math.PI) * weaveHeight)
      runner.setBaseScale(lerp(fromScale, laneScale, progress) * RUNNER_SCALE)
    })

    if (runner.isOnRamp) {
      runner.liftAndCarry(LIFT_DELAY)
    } else {
      // They were swallowed earlier; the new attempt gives them a fresh start.
      runner.dropIn(NEWCOMER_DROP_DELAY)
    }
  }

  /**
   * A lane leaving the screen sinks away. In a changeover whoever is still on
   * it falls first. In a reflow only a swallowed runner falls (they already
   * are); one simply out of view now — the screen turned to portrait, say —
   * is still racing, so sinks out of sight on their escalator instead.
   */
  private retireLane(lane: Lane, dropRunner: boolean): void {
    if (dropRunner) lane.runner.fall()
    lane.slideTo = null
    this.leavingLanes.push({ lane, secondsWaited: 0, isSinking: false })
  }

  private updateLeavingLanes(deltaSeconds: number): void {
    for (const leaving of this.leavingLanes) {
      const { lane } = leaving
      lane.ramp.update(deltaSeconds)
      lane.runner.update(deltaSeconds, this.isRacing)
      lane.nameplate.sprite.visible = false
      leaving.secondsWaited += deltaSeconds

      // A runner still on their feet rides it down; a falling one is waited for.
      const isReadyToSink =
        lane.runner.isGone || lane.runner.isOnRamp || leaving.secondsWaited > CHANGEOVER.LEAVER_MAX_WAIT
      if (!isReadyToSink || leaving.isSinking) continue
      leaving.isSinking = true
      this.tweens.add(
        0,
        CHANGEOVER.LEAVER_SINK_DURATION,
        (progress) => { lane.ramp.setHeightOffset(-CHANGEOVER.RISE_DEPTH * progress) },
        () => {
          this.removeLane(lane)
          this.leavingLanes = this.leavingLanes.filter((other) => other !== leaving)
        },
      )
    }
  }

  private removeLane(lane: Lane): void {
    this.scene.remove(lane.ramp.group, lane.runner.root, lane.nameplate.sprite)
    lane.ramp.dispose()
    lane.runner.dispose()
    lane.nameplate.dispose()
    lane.badge.dispose()
  }

  private resize(host: HTMLElement): void {
    const { clientWidth: width, clientHeight: height } = host
    if (width === 0 || height === 0) return
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.fov = CAMERA_FIELD_OF_VIEW
    this.camera.updateProjectionMatrix()
    this.fitCamera()
    this.snapCamera()
  }
}
