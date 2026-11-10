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
  INTRO,
  changeoverArrival,
  introArrival,
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
import { Nameplate } from '../../three/Nameplate.ts'
import { RunnerFigure } from './RunnerFigure.ts'
import { Tweener } from '../../three/tweens.ts'
import type { LaneView } from './types.ts'

interface Lane {
  player: RoundPlayerView
  ramp: EscalatorRamp
  runner: RunnerFigure
  nameplate: Nameplate
  badge: CanvasTexture
}

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
const MIN_LABEL_PIXELS = 90

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
  setRoster(players: readonly RoundPlayerView[], { introduce = false }: { introduce?: boolean } = {}): void {
    const isFirst = this.lanes.length === 0 && this.leavingLanes.length === 0
    const layout = layoutFor(players.length)
    const previous = new Map(this.lanes.map((lane) => [lane.player.playerId, lane]))
    const next: Lane[] = []

    players.forEach((player, index) => {
      const centerX = layout.slotXs[index]!
      const existing = previous.get(player.playerId)
      previous.delete(player.playerId)

      if (existing === undefined) {
        // On the first roster the lanes arrive with the opening animation if
        // asked to; later ones arrive as part of the changeover.
        const arrival = isFirst
          ? introduce ? introArrival(index, players.length) : null
          : changeoverArrival()
        next.push(this.createLane(player, centerX, layout.laneScale, arrival))
      } else {
        this.relocateLane(existing, centerX, layout.laneScale, (index - (players.length - 1) / 2) * CHANGEOVER.WEAVE_SPACING)
        next.push(existing)
      }
    })
    for (const leaving of previous.values()) this.retireLane(leaving)

    this.lanes = next
    this.layout = layout
    if (!isFirst) this.hideLabels(CHANGEOVER.LABELS_RETURN_DELAY, CHANGEOVER.LABELS_FADE_DURATION)
    else if (introduce) this.hideLabels(INTRO.TOTAL_SECONDS - INTRO.LABELS_FADE_DURATION, INTRO.LABELS_FADE_DURATION)
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
      // A swallowed runner leaves an empty escalator that keeps running.
      lane.ramp.setPowered(isRacing)
      lane.nameplate.update({
        name: lane.player.name,
        score: view.score,
        status: view.isFallen ? 'SWALLOWED' : view.gap > 0 ? `−${view.gap} behind` : 'LEADING',
        isYou: view.isYou,
        isFallen: view.isFallen,
      })
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
    for (const { ramp, runner, nameplate } of this.lanes) {
      ramp.update(deltaSeconds)
      runner.update(deltaSeconds, this.isRacing)
      // The tag rides above its runner, and is left behind when they fall.
      nameplate.sprite.visible = runner.isOnRamp
      nameplate.setOpacity(this.labelOpacity)
      nameplate.setWidth(this.labelWidth)
      nameplate.sprite.position.copy(runner.root.position).y += NAMEPLATE_HEIGHT * runner.root.scale.y
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
    if (slotXs.length < 2 || canvasHeight === 0) {
      this.labelWidth = labelWidthFor(MAX_LABEL_PIXELS, canvasHeight || 1, this.camera.fov)
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

    const pixels = Math.min(MAX_LABEL_PIXELS, Math.max(MIN_LABEL_PIXELS, gapPixels * LABEL_SHARE_OF_GAP))
    this.labelWidth = labelWidthFor(pixels, canvasHeight, this.camera.fov)
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
            NAMEPLATE_HEIGHT * laneScale * RUNNER_SCALE + 1,
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
    const nameplate = new Nameplate()
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
    return { player, ramp, runner, nameplate, badge }
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
      // They were swallowed earlier; the next stage gives them a fresh start.
      runner.dropIn(NEWCOMER_DROP_DELAY)
    }
  }

  /** A lane with nobody going on: whoever is still on it falls, and it sinks away. */
  private retireLane(lane: Lane): void {
    lane.runner.fall()
    this.leavingLanes.push({ lane, secondsWaited: 0, isSinking: false })
  }

  private updateLeavingLanes(deltaSeconds: number): void {
    for (const leaving of this.leavingLanes) {
      const { lane } = leaving
      lane.ramp.update(deltaSeconds)
      lane.runner.update(deltaSeconds, this.isRacing)
      lane.nameplate.sprite.visible = false
      leaving.secondsWaited += deltaSeconds

      const isReadyToSink = lane.runner.isGone || leaving.secondsWaited > CHANGEOVER.LEAVER_MAX_WAIT
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
