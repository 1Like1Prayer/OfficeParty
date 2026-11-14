import {
  AmbientLight,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  Clock,
  type Mesh,
  type Object3D,
} from 'three'
import { LAYER_COUNT, layerHeight, TILES } from '../../../shared/games/hexDrop/arena.ts'
import { HEX_DROP } from '../../../shared/games/hexDrop/constants.ts'
import type { Tile } from '../../../shared/games/hexDrop/types.ts'
import type { RoundPlayerView } from '../../../types/index.ts'
import { createAvatarTexture } from '../../three/avatarTexture.ts'
import { labelWidthFor } from '../../three/Nameplate.ts'
import { ScoreTag } from '../../three/ScoreTag.ts'
import { Runner } from '../../Minefield/scene/Runner.ts'

/** A narrow lens from far off: the floors look flat, close to isometric, and nothing at the edge is stretched. */
const FIELD_OF_VIEW = 38
/** Name tags are this wide on a tall screen, shrinking with a short one down to the minimum. */
const NAMEPLATE_PIXELS = 96
const NAMEPLATE_MIN_PIXELS = 64
const NAMEPLATE_SHARE_OF_HEIGHT = 0.13
const NAMEPLATE_LIFT = 2.6

/*
 * The camera: a 2.5D view from high up and steeply down, always from the same
 * side (so the arrow keys keep meaning up, down, left and right on screen),
 * backed off far enough that the whole floor the player is on fits the screen.
 * There is no mouse to look around with, so it shows as much as it can.
 */
/** How steeply it looks down, from the horizon. */
const CAMERA_ELEVATION = (56 * Math.PI) / 180
const CAMERA_DIRECTION = new Vector3(0, Math.sin(CAMERA_ELEVATION), Math.cos(CAMERA_ELEVATION))
/** How far the view leans from the middle of the floor toward the player: room to see past them, and the far side too. */
const PLAYER_BIAS = 0.25
/** Breathing room round the floor's edge. */
const FRAME_MARGIN = 1.25
const MIN_CAMERA_DISTANCE = 16
/** How quickly the camera backs off or closes in when the player drops to a different floor. */
const REFRAME_PER_SECOND = 2.5
/** Floors above the player's fade to this, so they never hide the floor being played. */
const FADED_FLOOR_OPACITY = 0.12
const FLOOR_FADE_PER_SECOND = 4

/** How far each floor reaches from the middle, to the outer corner of its outermost tile. */
const LAYER_REACH: readonly number[] = Array.from({ length: LAYER_COUNT }, (_, layer) =>
  Math.max(...TILES.filter((tile) => tile.layer === layer).map((tile) => Math.hypot(tile.x, tile.z))) +
  HEX_DROP.TILE_RADIUS,
)
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount

/** Fades every mesh under `root` to `opacity`, switching transparency on only when it is needed. */
function setOpacity(root: Object3D, opacity: number): void {
  root.traverse((object) => {
    const mesh = object as Partial<Mesh>
    if (mesh.material === undefined) return
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (material.opacity === opacity) continue
      const isSolid = opacity >= 0.999
      if (material.transparent !== !isSolid) {
        material.transparent = !isSolid
        material.needsUpdate = true
      }
      material.opacity = opacity
      material.depthWrite = isSolid
    }
  })
}

/** The floor nearest a height. */
const layerAt = (y: number): number =>
  Math.min(LAYER_COUNT - 1, Math.max(0, Math.round((layerHeight(0) - y) / HEX_DROP.LAYER_GAP)))

/** One colour per layer, top first. */
const LAYER_COLORS = ['#FF6FAE', '#FFC94A', '#55D6A6', '#6AA8FF'].map((hex) => new Color(hex))
const WARNING_COLOR = new Color('#FFF6E8')
/** The last stretch before a tile drops, when it shakes and flashes. */
const WARNING_MS = 1_000
/** How long a dropped tile is drawn falling away before it is gone. */
const DROP_ANIMATION_MS = 700

/** Where a runner is drawn this frame. Heights are world units; speeds are units per millisecond. */
export interface RunnerPose {
  playerId: string
  x: number
  y: number
  z: number
  vx: number
  vz: number
  /** The layer they are on or falling towards, for their tag. */
  layer: number
  isSelf: boolean
  isOut: boolean
  isWinner: boolean
}

/** Everything drawn this frame. */
export interface HexDropFrame {
  /** Race time being drawn, in ms. */
  nowMs: number
  runners: readonly RunnerPose[]
  /** When each tile drops (race ms), or undefined while nobody has stood on it. */
  fallAtMs: (tile: Tile) => number | undefined
  /** Where the camera follows, or null to look over the whole arena. */
  focus: { x: number; y: number; z: number } | null
}

interface Entry {
  player: RoundPlayerView
  runner: Runner
  nameplate: ScoreTag
  badge: CanvasTexture
}

function skyTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#6B5BD6')
  gradient.addColorStop(0.55, '#B98AE8')
  gradient.addColorStop(1, '#2E2A45')
  context.fillStyle = gradient
  context.fillRect(0, 0, 4, 256)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * Draws Hex Drop: the stacked layers of tiles, the runners and the camera.
 * It keeps no game state of its own; it draws whatever frame it is handed.
 */
export class HexDropScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.3, 400)
  private readonly clock = new Clock()
  private readonly sun = new DirectionalLight(0xfff0e0, 2.4)
  private readonly resizeObserver: ResizeObserver
  private readonly disposables: { dispose: () => void }[] = []
  /** One instanced mesh per layer, and where each tile sits in it. */
  private readonly layers: InstancedMesh[] = []
  private readonly slotOf = new Map<number, { layer: number; slot: number }>()
  private entries: Entry[] = []

  private readonly focus = new Vector3()
  private hasFocus = false
  private readonly lookAt = new Vector3()
  private overview = 0
  /** How far back the camera sits, easing toward what the current floor needs. */
  private distance = 0
  /** Floors above this one are faded, and so is anyone standing on them. */
  private fadedAbove = 0

  // Reused every frame, so drawing makes no garbage.
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly scale = new Vector3()
  private readonly turn = new Quaternion()
  private readonly color = new Color()
  private readonly wanted = new Vector3()

  constructor(host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    // Sized to its host by CSS; `resize` sets only the drawing buffer, which is denser on a high-DPI screen.
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
    host.appendChild(this.renderer.domElement)

    const sky = skyTexture()
    this.disposables.push(sky)
    this.scene.background = sky
    // Far enough out that the 2.5D camera, well back from the floors, sees them clearly.
    this.scene.fog = new Fog(new Color('#8E74D8'), 80, 200)
    this.scene.add(new HemisphereLight(0xfff4e6, 0x5a4a8a, 1.2), new AmbientLight(0xffffff, 0.25))

    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const shadow = this.sun.shadow.camera
    shadow.left = -22
    shadow.right = 22
    shadow.top = 22
    shadow.bottom = -22
    shadow.near = 1
    shadow.far = 90
    this.sun.shadow.bias = -0.0008
    this.scene.add(this.sun, this.sun.target)

    this.buildTiles()

    this.resizeObserver = new ResizeObserver(() => { this.resize(host) })
    this.resizeObserver.observe(host)
    this.resize(host)
  }

  /** Who is racing. */
  setRoster(players: readonly RoundPlayerView[]): void {
    for (const entry of this.entries) this.removeEntry(entry)
    this.entries = players.map((player) => {
      const badge = createAvatarTexture({ initial: player.initial, color: player.color, seed: player.avatar })
      const runner = new Runner(player.color, badge)
      const nameplate = new ScoreTag()
      this.scene.add(runner.root, nameplate.sprite)
      return { player, runner, nameplate, badge }
    })
  }

  /** Draws one frame. */
  render(frame: HexDropFrame): void {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05)
    this.updateTiles(frame)
    this.updateRunners(frame, deltaSeconds)
    this.updateCamera(frame, deltaSeconds)
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.resizeObserver.disconnect()
    for (const entry of this.entries) this.removeEntry(entry)
    for (const layer of this.layers) layer.dispose()
    this.disposables.forEach((item) => { item.dispose() })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  /* ---------------- building ---------------- */

  private buildTiles(): void {
    // Drawn a touch smaller than they are, so the seams between them show.
    const geometry = new CylinderGeometry(
      HEX_DROP.TILE_RADIUS * 0.96,
      HEX_DROP.TILE_RADIUS * 0.9,
      HEX_DROP.TILE_THICKNESS,
      6,
    )
    this.disposables.push(geometry)

    for (let layer = 0; layer < LAYER_COUNT; layer++) {
      const tiles = TILES.filter((tile) => tile.layer === layer)
      // Each floor its own material, so the ones above the player can fade on their own.
      const material = new MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 })
      this.disposables.push(material)
      const mesh = new InstancedMesh(geometry, material, tiles.length)
      mesh.castShadow = true
      mesh.receiveShadow = true
      tiles.forEach((tile, slot) => {
        this.slotOf.set(tile.id, { layer, slot })
        mesh.setColorAt(slot, LAYER_COLORS[layer]!)
      })
      this.layers.push(mesh)
      this.scene.add(mesh)
    }
  }

  /* ---------------- frame ---------------- */

  private updateTiles(frame: HexDropFrame): void {
    const { nowMs } = frame
    for (const tile of TILES) {
      const { layer, slot } = this.slotOf.get(tile.id)!
      const mesh = this.layers[layer]!
      const fallAtMs = frame.fallAtMs(tile)
      const surface = layerHeight(tile.layer) - HEX_DROP.TILE_THICKNESS / 2
      let y = surface
      let size = 1
      let shakeX = 0
      let shakeZ = 0
      this.color.copy(LAYER_COLORS[layer]!)

      if (fallAtMs !== undefined) {
        const untilMs = fallAtMs - nowMs
        if (untilMs <= 0) {
          // Dropping away, then gone.
          const ageS = -untilMs / 1000
          y = surface - 0.5 * HEX_DROP.GRAVITY * ageS * ageS
          size = Math.max(0, 1 - -untilMs / DROP_ANIMATION_MS)
        } else {
          // Stood on: it pales as its time runs out, and shakes and flashes at the end.
          const used = 1 - untilMs / HEX_DROP.FALL_DELAY_MS
          this.color.lerp(WARNING_COLOR, Math.min(1, used) * 0.55)
          if (untilMs < WARNING_MS) {
            const strength = (1 - untilMs / WARNING_MS) * 0.08
            shakeX = Math.sin(nowMs * 0.09 + tile.id) * strength
            shakeZ = Math.cos(nowMs * 0.11 + tile.id * 2) * strength
            if (Math.floor(nowMs / 90) % 2 === 0) this.color.lerp(WARNING_COLOR, 0.5)
          }
        }
      }

      this.position.set(tile.x + shakeX, y, tile.z + shakeZ)
      this.scale.set(size, size, size)
      this.matrix.compose(this.position, this.turn, this.scale)
      mesh.setMatrixAt(slot, this.matrix)
      mesh.setColorAt(slot, this.color)
    }
    for (const mesh of this.layers) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
    }
  }

  private updateRunners(frame: HexDropFrame, deltaSeconds: number): void {
    const canvasHeight = this.renderer.domElement.clientHeight || 1
    const pixels = Math.min(NAMEPLATE_PIXELS, Math.max(NAMEPLATE_MIN_PIXELS, canvasHeight * NAMEPLATE_SHARE_OF_HEIGHT))
    const labelWidth = labelWidthFor(pixels, canvasHeight, FIELD_OF_VIEW)
    const byId = new Map(frame.runners.map((runner) => [runner.playerId, runner]))

    for (const entry of this.entries) {
      const pose = byId.get(entry.player.playerId)
      // Someone who has fallen out is gone from the arena; their tag goes with them.
      const isShown = pose !== undefined && !(pose.isOut && pose.y < layerHeight(LAYER_COUNT - 1) - 4)
      entry.runner.root.visible = isShown
      entry.nameplate.sprite.visible = isShown
      if (pose === undefined || !isShown) continue

      entry.runner.update(
        {
          playerId: pose.playerId,
          x: pose.x,
          y: pose.z,
          atMs: frame.nowMs,
          vx: pose.vx,
          vy: pose.vz,
          isSelf: pose.isSelf,
          state: pose.isWinner ? 'won' : 'racing',
          isProtected: false,
          lives: 1,
        },
        deltaSeconds,
        frame.nowMs,
      )
      entry.runner.root.position.y = pose.y
      // Someone on a floor faded above the player fades with it, rather than looming in front of the camera.
      setOpacity(entry.runner.root, pose.layer < this.fadedAbove ? FADED_FLOOR_OPACITY * 2 : 1)
      entry.nameplate.setWidth(labelWidth)
      entry.nameplate.sprite.position.set(entry.runner.root.position.x, pose.y + NAMEPLATE_LIFT, entry.runner.root.position.z)
      // Only the name; someone out of the round is faded.
      entry.nameplate.update({ name: entry.player.name, score: '', isYou: pose.isSelf, isFaded: pose.isOut })
    }
  }

  private updateCamera(frame: HexDropFrame, deltaSeconds: number): void {
    const { focus } = frame
    if (focus !== null) {
      this.wanted.set(focus.x, focus.y, focus.z)
      if (!this.hasFocus) {
        this.focus.copy(this.wanted)
        this.hasFocus = true
      } else {
        // Snappy sideways, softer up and down, so a drop to the next floor reads as a fall.
        const side = 1 - Math.exp(-10 * deltaSeconds)
        const fall = 1 - Math.exp(-5 * deltaSeconds)
        this.focus.x += (this.wanted.x - this.focus.x) * side
        this.focus.z += (this.wanted.z - this.focus.z) * side
        this.focus.y += (this.wanted.y - this.focus.y) * fall
      }
    }
    this.overview += ((focus === null ? 1 : 0) - this.overview) * (1 - Math.exp(-2.5 * deltaSeconds))

    // Framed on the floor the player is on (or heading down to); a watcher sees the widest, bottom one.
    const floor = focus === null ? LAYER_COUNT - 1 : layerAt(this.wanted.y)
    const wantedDistance = lerp(this.fitDistance(LAYER_REACH[floor]!), this.fitDistance(LAYER_REACH[LAYER_COUNT - 1]!), this.overview)
    this.distance =
      this.distance === 0
        ? wantedDistance
        : this.distance + (wantedDistance - this.distance) * (1 - Math.exp(-REFRAME_PER_SECOND * deltaSeconds))

    // Between the middle of the floor and the player, at the player's height; the middle of the arena when watching.
    const followX = this.focus.x * PLAYER_BIAS
    const followZ = this.focus.z * PLAYER_BIAS
    const watchY = layerHeight(LAYER_COUNT - 1)
    this.lookAt.set(
      lerp(followX, 0, this.overview),
      lerp(this.focus.y, watchY, this.overview),
      lerp(followZ, 0, this.overview),
    )
    this.position.copy(this.lookAt).addScaledVector(CAMERA_DIRECTION, this.distance)
    this.fadedAbove = focus === null ? 0 : floor
    this.fadeFloorsAbove(this.fadedAbove, deltaSeconds)
    this.camera.position.copy(this.position)
    this.camera.lookAt(this.lookAt)

    // The sun's shadow follows the action.
    this.sun.target.position.copy(this.lookAt)
    this.sun.position.set(this.lookAt.x - 14, this.lookAt.y + 40, this.lookAt.z + 18)
  }

  /**
   * Looking straight down, the floors above the player would hide theirs, so
   * those fade to a ghost of themselves — still there to see, no longer in the
   * way — and stop casting shadows. Watching the whole arena, none fade.
   */
  private fadeFloorsAbove(floor: number, deltaSeconds: number): void {
    const ease = 1 - Math.exp(-FLOOR_FADE_PER_SECOND * deltaSeconds)
    this.layers.forEach((mesh, layer) => {
      const material = mesh.material as MeshStandardMaterial
      const wanted = layer < floor ? FADED_FLOOR_OPACITY : 1
      const opacity = material.opacity + (wanted - material.opacity) * ease
      material.opacity = Math.abs(wanted - opacity) < 0.005 ? wanted : opacity
      const isSolid = material.opacity >= 0.999
      if (material.transparent === isSolid) {
        material.transparent = !isSolid
        material.needsUpdate = true
      }
      material.depthWrite = isSolid
      mesh.castShadow = material.opacity > 0.5
    })
  }

  /**
   * How far back the camera has to be for a floor this wide to fit the
   * screen, whatever its shape: across by the narrower of the two angles, and
   * up and down by how much the floor rises toward the camera at this tilt.
   */
  private fitDistance(reach: number): number {
    const halfTan = Math.tan((FIELD_OF_VIEW * Math.PI) / 360)
    const across = reach / (halfTan * this.camera.aspect)
    // A flat disc seen from this tilt is squashed to sin(elevation) of its depth.
    const upAndDown = (reach * Math.sin(CAMERA_ELEVATION)) / halfTan
    return Math.max(MIN_CAMERA_DISTANCE, Math.max(across, upAndDown) * FRAME_MARGIN)
  }

  private resize(host: HTMLElement): void {
    const width = host.clientWidth || 1
    const height = host.clientHeight || 1
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private removeEntry(entry: Entry): void {
    this.scene.remove(entry.runner.root, entry.nameplate.sprite)
    entry.runner.dispose()
    entry.nameplate.dispose()
    entry.badge.dispose()
  }
}
