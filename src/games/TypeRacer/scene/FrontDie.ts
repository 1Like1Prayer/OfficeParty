import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three'
import { assignFaces, quaternionShowing } from './Die.ts'
import type { RollView } from './Station.ts'

const DIE_SIZE = 2
const HALF = DIE_SIZE / 2
const FIELD_OF_VIEW = 38
/** How steeply the camera looks down at the tray, so the face that lands up is the face it sees. */
const ELEVATION = 0.62
/** The whole screen is always this tall in the scene's units, so the moment is the same size on any window. */
const VISIBLE_HEIGHT = 6.6
const TRAY_RADIUS = 2.25
const FLOOR_Y = 0
const UP = new Vector3(0, 1, 0)

/**
 * The stages of the moment, in seconds. The whole of it is the four seconds
 * the player cannot type: shaken for a while (longer if the server is slow to
 * answer), thrown, and then held on screen so the result can be read.
 */
const SHAKE_SECONDS = 1.1
const THROW_SECONDS = 1.4
/** After it lands: the result is read, and then the tray makes its exit. */
const HOLD_SECONDS = 1.5
/** The tray swoops in from the back while the die is already being shaken. */
const ENTRANCE_SECONDS = 0.7
/** And leaves in the last part of the hold: a pull back, then a whoosh away. */
const EXIT_SECONDS = 0.5
/** The total length of a roll when the server answers straight away. */
export const FRONT_DIE_SECONDS = SHAKE_SECONDS + THROW_SECONDS + HOLD_SECONDS

/** The physics of the throw. */
const GRAVITY = 17
const RESTITUTION = 0.5
const SURFACE_FRICTION = 0.7
const STEP = 1 / 90
const MAX_FLIGHT_SECONDS = 2.2

/** Where the die hovers while it is shaken, over the middle of the tray and toward the player. */
const SHAKE_CENTER = new Vector3(0, 1.7, 0.7)
/** Where the throw tries to leave it resting: near the middle of the tray. */
const REST_X = 0.1
const REST_Z = -0.1

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
/** Overshoots a little, then settles: the "pop" of something appearing. */
const easeOutBack = (x: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3)
/** Pulls back a little before rushing away: the wind-up of a throw. */
const easeInBack = (x: number): number => {
  const c1 = 1.70158
  return (c1 + 1) * x * x * x - c1 * x * x
}

/** How far a cube turned by `q` reaches above and below its own centre. */
function halfExtentY(q: Quaternion): number {
  const { x, y, z, w } = q
  return HALF * (Math.abs(2 * (x * y + w * z)) + Math.abs(1 - 2 * (x * x + z * z)) + Math.abs(2 * (y * z - w * x)))
}

/** One step of a simulated throw. */
interface Sample {
  x: number
  z: number
  /** How far the die's lowest point is above the tray. Zero when it touches. */
  air: number
  /** How much it has turned since leaving the hand. */
  turned: Quaternion
}

interface Roll {
  /** How many of the die's sides are skulls, known from the moment it is picked up. */
  skulls: number
  /** What the server rolled; null until it answers, and the die keeps shaking till then. */
  view: RollView | null
  clock: number
  /** When the throw began, in the roll's own seconds, or null while still shaking. */
  throwStartedAt: number | null
  hasLanded: boolean
  onLanded: (() => void) | null
  /** How the die was turned in the hand when it was released. */
  releaseTurn: Quaternion
  /** The turn that brings the thrown die to rest on the face it must show, added gently over the last bounces. */
  correction: Quaternion
  samples: Sample[]
  /** How far the simulated throw ends from where the throw wants it, so the difference can be eased out. */
  restOffset: { x: number; z: number }
  /** The simulated hand position, kept so shaking can resume from where it left off. */
  shakePosition: Vector3
  shakeTurn: Quaternion
}

/** Big words under the die, drawn on a canvas and shown as a sprite. */
class Caption {
  readonly sprite: Sprite
  private readonly canvas = document.createElement('canvas')
  private readonly texture: CanvasTexture
  private text = ''

  constructor() {
    this.canvas.width = 1024
    this.canvas.height = 220
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.sprite = new Sprite(new SpriteMaterial({ map: this.texture, transparent: true, depthTest: false }))
    this.sprite.renderOrder = 20
  }

  /** Sits in front of the camera, centred horizontally, `down` below the middle, at `distance`. */
  anchor(distance: number, down: number, width: number): void {
    this.sprite.position.set(0, -down, -distance)
    this.sprite.scale.set(width, (width * 220) / 1024, 1)
  }

  show(text: string, tint: string): void {
    if (text === this.text) return
    this.text = text
    const context = this.canvas.getContext('2d')!
    context.clearRect(0, 0, 1024, 220)
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineJoin = 'round'
    context.font = '900 124px sans-serif'
    context.lineWidth = 22
    context.strokeStyle = '#2E2A45'
    context.strokeText(text, 512, 112)
    context.fillStyle = tint
    context.fillText(text, 512, 112)
    this.texture.needsUpdate = true
  }

  setOpacity(opacity: number): void {
    this.sprite.material.opacity = opacity
  }

  dispose(): void {
    this.texture.dispose()
    this.sprite.material.dispose()
  }
}

/** A round felt-lined tray for the die to land on, with a wooden rim. */
function buildTray(): { group: Group; dispose: () => void } {
  const group = new Group()
  const felt = new MeshStandardMaterial({ color: 0x1d5a3c, roughness: 0.95 })
  const wood = new MeshStandardMaterial({ color: 0x6b4423, roughness: 0.75 })

  const floorGeometry = new CircleGeometry(TRAY_RADIUS, 64).rotateX(-Math.PI / 2)
  const floor = new Mesh(floorGeometry, felt)
  floor.position.y = FLOOR_Y - 0.001
  floor.receiveShadow = true

  const rimGeometry = new TorusGeometry(TRAY_RADIUS, 0.13, 14, 64).rotateX(Math.PI / 2)
  const rim = new Mesh(rimGeometry, wood)
  rim.position.y = FLOOR_Y + 0.02
  rim.receiveShadow = true
  rim.castShadow = true

  const baseGeometry = new CylinderGeometry(TRAY_RADIUS + 0.1, TRAY_RADIUS + 0.2, 0.3, 64)
  const base = new Mesh(baseGeometry, wood)
  base.position.y = FLOOR_Y - 0.17
  base.receiveShadow = true

  group.add(floor, rim, base)
  return {
    group,
    dispose: () => {
      floorGeometry.dispose()
      rimGeometry.dispose()
      baseGeometry.dispose()
      felt.dispose()
      wood.dispose()
    },
  }
}

/**
 * The dice roll as a moment of its own, on the front layer in the middle of
 * the screen: the world dims, a big die appears over a felt tray and is
 * shaken, thrown, bounces and tumbles to rest, and what it shows is held for
 * the player to read. A heart says "Safe! For now..."; a skull says nothing —
 * the world answers.
 *
 * The throw is simulated: gravity, bounces that lose energy and scatter the
 * spin, a die that really is lower when it lands on a face than on a corner,
 * and a shadow on the felt. It has its own little scene, drawn over the main
 * one, so nothing in the world can hide it.
 */
export class FrontDie {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 80)
  private readonly mesh: Mesh
  private readonly faceMaterials: [MeshStandardMaterial, MeshStandardMaterial]
  private readonly stage = new Group()
  private readonly tray = buildTray()
  private readonly caption = new Caption()
  private readonly spot = new PointLight(0xffd9a0, 0, 40, 1.4)
  private roll: Roll | null = null
  /** The die has a canvas of its own, stacked above everything else on the screen. */
  private renderer: WebGLRenderer | null = null
  private wasDrawing = false
  private readonly euler = new Euler()
  private readonly scratch = new Quaternion()
  private readonly identity = new Quaternion()
  private readonly settleTurn = new Quaternion()

  constructor(heart: Texture, skull: Texture) {
    this.faceMaterials = [
      new MeshStandardMaterial({ map: heart, roughness: 0.3 }),
      new MeshStandardMaterial({ map: skull, roughness: 0.3 }),
    ]
    this.mesh = new Mesh(new BoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE), [
      ...Array.from({ length: 6 }, () => this.faceMaterials[0]),
    ])
    this.mesh.castShadow = true
    this.mesh.visible = false

    this.stage.add(this.tray.group, this.mesh)
    this.stage.visible = false

    // A warm light over the tray, and one that throws the die's shadow onto it.
    const key = new DirectionalLight(0xfff1dc, 2.6)
    key.position.set(3, 9, 5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.bias = -0.0005
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 })
    this.spot.position.set(0, 6, 2)

    // The caption is fixed to the camera, so it stays put on screen.
    this.camera.add(this.caption.sprite)
    this.scene.add(this.camera, this.stage, key, this.spot, new AmbientLight(0xffffff, 0.9))
    this.caption.sprite.visible = false
  }

  get isActive(): boolean {
    return this.roll !== null
  }

  /**
   * Pick the die up and start shaking it. This happens the moment the player
   * earns the roll, before the server has said how it lands: the shaking is
   * the wait, and goes on until the answer comes.
   */
  begin(skulls: number): void {
    assignFaces(this.mesh.material as MeshStandardMaterial[], this.faceMaterials[0], this.faceMaterials[1], skulls)
    this.roll = {
      skulls,
      view: null,
      clock: 0,
      throwStartedAt: null,
      hasLanded: false,
      onLanded: null,
      releaseTurn: new Quaternion(),
      correction: new Quaternion(),
      samples: [],
      restOffset: { x: 0, z: 0 },
      shakePosition: SHAKE_CENTER.clone(),
      shakeTurn: new Quaternion(),
    }
    this.stage.visible = true
    this.mesh.visible = true
    this.present(0, 0)
    this.caption.sprite.visible = false
    this.caption.setOpacity(1)
  }

  /**
   * The server has said how the die lands. It is thrown as soon as the
   * shaking has had its time, and `onLanded` fires the instant it comes to rest.
   */
  resolve(view: RollView, onLanded: () => void): void {
    if (this.roll === null) this.begin(view.skulls)
    const roll = this.roll!
    roll.view = view
    roll.onLanded = onLanded
  }

  update(deltaSeconds: number): void {
    const roll = this.roll
    if (roll === null) return

    roll.clock += deltaSeconds
    const t = roll.clock

    // Thrown once the answer is in and the shaking has had its time.
    if (roll.throwStartedAt === null && roll.view !== null && t >= SHAKE_SECONDS) {
      roll.throwStartedAt = t
      this.planThrow(roll)
    }

    if (roll.throwStartedAt === null) this.shake(roll, t)
    else this.throw(roll, (t - roll.throwStartedAt) / THROW_SECONDS)

    // The tray swoops in from the back, and at the end pulls back and whooshes away.
    const end = roll.throwStartedAt === null ? Number.POSITIVE_INFINITY : roll.throwStartedAt + THROW_SECONDS + HOLD_SECONDS
    const exit = Math.min(1, Math.max(0, (t - (end - EXIT_SECONDS)) / EXIT_SECONDS))
    this.present(Math.min(1, t / ENTRANCE_SECONDS), exit)

    this.caption.setOpacity(1 - smoothstep(0.55, 1, exit))
    if (t >= end) this.cancel()
  }

  /**
   * Where the tray and die are as a whole. They arrive from far behind and
   * below, swinging round and overshooting as they settle in front of the
   * player; and they leave by pulling back a little, then flying up and away
   * the way they came, spinning.
   */
  private present(entrance: number, exit: number): void {
    const arrive = easeOutCubic(entrance)
    const leave = easeInBack(exit)
    const { position, rotation } = this.stage

    position.set(
      -3.2 * (1 - arrive) + 3.2 * leave,
      -2.4 * (1 - arrive) + Math.sin(entrance * Math.PI) * 0.6 + 2.6 * leave,
      -17 * (1 - arrive) - 17 * leave,
    )
    rotation.set(
      -0.5 * (1 - arrive) + 0.3 * leave,
      -2.6 * (1 - arrive) + 2.8 * leave,
      0.55 * (1 - arrive) - 0.4 * leave,
    )
    // It pops a little past full size on arrival, and shrinks as it flies off.
    const grow = Math.max(0.0001, easeOutBack(entrance))
    this.stage.scale.setScalar(Math.max(0.0001, grow * (1 - 0.7 * Math.max(0, leave))))
    this.spot.intensity = 90 * arrive * (1 - smoothstep(0.3, 1, exit))
  }

  /** Drop a roll in progress, such as when the race ends under it: the result no longer matters. */
  cancel(): void {
    if (this.roll === null) return
    this.roll = null
    this.stage.visible = false
    this.mesh.visible = false
    this.caption.sprite.visible = false
    this.stage.position.set(0, 0, 0)
    this.stage.rotation.set(0, 0, 0)
    this.spot.intensity = 0
  }

  /**
   * Give the die a canvas of its own inside `host`. The host sits above the
   * rest of the game's screen, so the die is the nearest thing the player sees
   * — in front of the text and the progress bar too. The canvas is transparent,
   * and drawn only while a roll is going on.
   */
  attach(host: HTMLElement): void {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' })
    host.appendChild(this.renderer.domElement)
    this.resize(host.clientWidth, host.clientHeight)
  }

  /** The screen changed size: the die stays in the middle of it, the same size on screen. */
  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return
    this.renderer?.setSize(width, height)
    this.camera.aspect = width / height
    // Back the camera off until the whole screen spans VISIBLE_HEIGHT units.
    const heightAtOneUnit = 2 * Math.tan((FIELD_OF_VIEW * Math.PI) / 360)
    const distance = VISIBLE_HEIGHT / heightAtOneUnit
    // Looking down at the tray from in front of it.
    this.camera.position.set(0, Math.sin(ELEVATION) * distance, Math.cos(ELEVATION) * distance)
    this.camera.lookAt(0, 0.3, 0)
    // The caption is fixed to the camera, so it sits at the same place on screen at any size.
    const scale = distance / 12
    this.caption.anchor(distance, 1.95 * scale, 5.4 * scale)
    this.camera.updateProjectionMatrix()
  }

  /** Draws the roll on its own canvas, and wipes the canvas once when it is over. */
  render(): void {
    if (this.renderer === null) return
    if (this.roll !== null) {
      this.renderer.render(this.scene, this.camera)
      this.wasDrawing = true
    } else if (this.wasDrawing) {
      this.renderer.clear()
      this.wasDrawing = false
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.faceMaterials.forEach((material) => { material.dispose() })
    this.tray.dispose()
    this.caption.dispose()
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
  }

  /* ---------------- the two halves ---------------- */

  /** Rattling about, the way a die is shaken in a cup: round and round, quickening, never a jolt. */
  private shake(roll: Roll, t: number): void {
    const force = smoothstep(0, 0.3, t)
    const speed = 11 + 7 * smoothstep(0, SHAKE_SECONDS, t)
    const phase = t * speed

    this.mesh.position.set(
      SHAKE_CENTER.x + (Math.sin(phase) * 0.3 + Math.sin(phase * 2.3 + 1) * 0.1) * force,
      SHAKE_CENTER.y + (Math.cos(phase * 1.2) * 0.22 + Math.sin(phase * 3.1) * 0.07) * force,
      SHAKE_CENTER.z + Math.cos(phase * 0.8) * 0.18 * force,
    )
    // Tumbling slowly inside the cup while it rattles.
    this.euler.set(
      Math.sin(phase * 0.9) * 0.5 * force + t * 1.7,
      Math.cos(phase * 0.7) * 0.6 * force + t * 2.5,
      Math.sin(phase * 1.1 + 2) * 0.4 * force,
    )
    this.mesh.quaternion.setFromEuler(this.euler)
    roll.shakePosition.copy(this.mesh.position)
    roll.shakeTurn.copy(this.mesh.quaternion)
  }

  /**
   * Work out the whole throw at the moment of release: a die leaves the hand
   * and obeys gravity. Each time it hits the tray it loses speed, loses some
   * of its sideways travel to friction, and has its spin knocked about.
   */
  private planThrow(roll: Roll): void {
    roll.releaseTurn.copy(roll.shakeTurn)
    const position = roll.shakePosition.clone()
    const velocity = new Vector3(0.5 + Math.random() * 0.8, 1.1 + Math.random() * 0.7, -(2.1 + Math.random() * 0.8))
    const axis = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    const spin = axis.multiplyScalar(20 + Math.random() * 8)

    const turned = new Quaternion()
    const step = new Quaternion()
    const turn = new Quaternion()
    const samples: Sample[] = []
    let bounces = 0

    for (let time = 0; time < MAX_FLIGHT_SECONDS; time += STEP) {
      velocity.y -= GRAVITY * STEP
      position.addScaledVector(velocity, STEP)

      const speed = spin.length()
      if (speed > 1e-4) {
        step.setFromAxisAngle(this.scratchAxis.copy(spin).divideScalar(speed), speed * STEP)
        turned.premultiply(step)
      }
      turn.copy(turned).multiply(roll.releaseTurn)
      const resting = FLOOR_Y + halfExtentY(turn)

      if (position.y <= resting) {
        position.y = resting
        if (velocity.y < 0) {
          const impact = -velocity.y
          velocity.y = impact * RESTITUTION
          velocity.x *= SURFACE_FRICTION
          velocity.z *= SURFACE_FRICTION
          // The knock scatters the spin: slower, and in a new direction.
          spin.multiplyScalar(0.55)
          spin.add(new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(Math.min(7, impact * 0.9)))
          bounces += 1
        }
      }
      samples.push({ x: position.x, z: position.z, air: position.y - resting, turned: turned.clone() })

      // Come to rest after a few bounces, once it has stopped leaving the tray.
      if (bounces >= 3 && velocity.y < 0.7 && position.y - resting < 0.01) break
    }

    // Left to itself the throw ends wherever it ends; the difference from where
    // we want it is eased out so it comes to rest on the tray's middle.
    const last = samples[samples.length - 1]!
    roll.restOffset = { x: REST_X - last.x, z: REST_Z - last.z }
    roll.samples = samples

    // The face it must show lands up, turned a random way about the vertical.
    const target = quaternionShowing(roll.view!.face, UP).premultiply(new Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2))
    const endTurn = last.turned.clone().multiply(roll.releaseTurn)
    roll.correction.copy(target).multiply(endTurn.invert())
  }

  private readonly scratchAxis = new Vector3()

  /** Plays the planned throw back: a smooth blend between its samples. */
  private throw(roll: Roll, progress: number): void {
    const u = Math.min(1, progress)
    const { samples } = roll
    const position = u * (samples.length - 1)
    const index = Math.min(samples.length - 2, Math.floor(position))
    const blend = position - index
    const from = samples[index]!
    const to = samples[index + 1]!

    // How far through the throw the die is being nudged onto its final face.
    const settle = smoothstep(0.5, 1, u)
    const ease = smoothstep(0, 1, u)

    this.scratch.copy(from.turned).slerp(to.turned, blend)
    this.mesh.quaternion
      .copy(this.scratch)
      .multiply(roll.releaseTurn)
      .premultiply(this.settleTurn.slerpQuaternions(this.identity, roll.correction, settle))

    const air = from.air + (to.air - from.air) * blend
    this.mesh.position.set(
      from.x + (to.x - from.x) * blend + roll.restOffset.x * ease,
      FLOOR_Y + halfExtentY(this.mesh.quaternion) + air,
      from.z + (to.z - from.z) * blend + roll.restOffset.z * ease,
    )

    if (u >= 1 && !roll.hasLanded) {
      roll.hasLanded = true
      this.land(roll)
    }
  }

  /** It has come to rest: say what it means, and let the world know. */
  private land(roll: Roll): void {
    // Only a heart gets words. A skull needs none: the world is about to answer.
    if (roll.view !== null && !roll.view.isSkull) {
      this.caption.sprite.visible = true
      this.caption.show('Safe! For now...', '#FF8FB8')
    }
    roll.onLanded?.()
  }
}
