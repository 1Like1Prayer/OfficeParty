import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Clock,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type CanvasTexture as CanvasTextureType,
} from 'three'
import type { RoundPlayerView } from '../../../types/index.ts'
import { createAvatarTexture } from '../../three/avatarTexture.ts'
import { labelWidthFor } from '../../three/Nameplate.ts'
import { ScoreTag } from '../../three/ScoreTag.ts'
import { Clash } from './Clash.ts'
import { Mage, type MagePose } from './Mage.ts'
import { SpellBeam } from './SpellBeam.ts'

const FIELD_OF_VIEW = 42
const NAMEPLATE_PIXELS = 92
const NAMEPLATE_MIN_PIXELS = 62
const NAMEPLATE_SHARE_OF_HEIGHT = 0.12
const NAMEPLATE_LIFT = 3.1

/** The clash: where every beam meets, at wand height. */
const CLASH = new Vector3(0, 1.5, 0)

/*
 * The opening: the camera circles the arena from beyond the standing stones
 * while each mage in turn raises their wand, gathers a spell at its tip and fires
 * their beam into the middle; once the start is being counted in, it circles
 * round to behind this player's mage, looking over their shoulder at the
 * clash, and the dial comes up on top.
 */
/** Each mage gathers their spell for this long before firing it. */
const CHARGE_MS = 1_100
const BEAM_FIRST_FIRES_MS = 1_500
const BEAM_STAGGER_MS = 380
/** The beam shoots out fast once fired. */
const BEAM_GROW_MS = 220
const CAMERA_FLIGHT_SECONDS = 2.2
/**
 * Over the shoulder: this far behind the mage and this high, looking at the
 * clash. High enough that the line to the clash passes over the mage's hat,
 * so the clash sits in the middle of the dial with the mage below it.
 */
const SHOULDER_BACK = 4.5
const SHOULDER_HEIGHT = 7
/** The circling camera: how fast it goes round, and (for someone watching once it starts) how far it rises. */
const ORBIT_PER_SECOND = 0.16
/** In the opening: well back, beyond the standing stones, and up over their tops, looking down across the circle. */
const OPENING_BACK = 11
const OPENING_HEIGHT = 7
const OPENING_LOOK_LIFT = 0.3
/**
 * The flight carries on turning the way the circle was, at the speed it was,
 * and slows to a stop behind this player's mage. Slowing evenly from the
 * circle's speed to rest, it covers this much of the turn.
 */
const FLIGHT_TURN = (ORBIT_PER_SECOND * CAMERA_FLIGHT_SECONDS) / 2
const TAU = Math.PI * 2

/** How quickly a watcher's camera rises from the opening's circle once the duel starts. */
const RISE_PER_SECOND = 0.6

/** A hit sends a surge down the beam that fades over this long; a miss makes it sputter this long. */
const SURGE_SECONDS = 0.6
const SPUTTER_SECONDS = 0.6
/** A landed spell shakes the camera, more for more points; it settles at this rate. */
const SHAKE_DECAY_PER_SECOND = 4

/** One mage, as the frame wants them drawn. */
export interface MageView {
  playerId: string
  pose: MagePose
  /** Where they stand on the battle bar, 0 (about to be knocked out) to 1 (level with the leader): their beam's might. */
  might: number
  score: number
  isSelf: boolean
}

export interface BattleFrame {
  mages: readonly MageView[]
  /** Over this player's shoulder, or circling the whole arena. */
  focusOnSelf: boolean
  /** Before the start is counted in: the camera circles the whole arena. */
  isOpening: boolean
  /**
   * Seconds until the flight to this player's shoulder is due (when the start
   * is counted in), or null if not known. The circle is timed by it, so it
   * arrives just short of the shoulder still turning, and flies on round.
   */
  secondsToFlight: number | null
}

interface Entry {
  player: RoundPlayerView
  mage: Mage
  beam: SpellBeam
  tag: ScoreTag
  badge: CanvasTextureType
  /** Their place round the circle. */
  angle: number
  /** Order they fire in during the opening; this player first. */
  turn: number
  isSelf: boolean
  strength: number
  surge: number
  sputter: number
  /** The opening: whether their beam has been fired yet, and has reached the clash. */
  hasFired: boolean
  hasArrived: boolean
  color: Color
}

const smoothstep = (t: number): number => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

function skyTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#1B2240')
  gradient.addColorStop(0.55, '#3B3F6E')
  gradient.addColorStop(1, '#2E2A45')
  context.fillStyle = gradient
  context.fillRect(0, 0, 4, 256)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** How far out the mages stand: room for everyone, and never so close the beams are stubs. */
export const circleRadius = (count: number): number => Math.min(11, Math.max(5, 3.2 + count * 0.55))

/**
 * Draws Mage Battle: the mages in their circle, their beams meeting in the
 * middle, and the camera. It keeps no game state of its own; it draws
 * whatever frame it is handed, plus the flourishes it is told about.
 */
export class MageBattleScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.3, 300)
  private readonly clock = new Clock()
  private readonly resizeObserver: ResizeObserver
  private readonly disposables: { dispose: () => void }[] = []
  private readonly clash: Clash
  private entries: Entry[] = []
  private radius = 6

  private seconds = 0
  /** 0 circling the arena, 1 over this player's shoulder, flown between with an ease. */
  private flight = 0
  /** Where round the circle the flight to the shoulder set off from, and how far round it turns. */
  private flightFrom: { angle: number; turn: number } | null = null
  /** 0 the opening's circle, 1 the higher one someone watching gets once the duel starts. */
  private rise = 0
  private shake = 0

  // Reused every frame, so drawing makes no garbage.
  private readonly tip = new Vector3()
  private readonly eye = new Vector3()
  private readonly target = new Vector3()
  private readonly overTarget = new Vector3()
  private readonly feeding: Color[] = []

  constructor(host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
    host.appendChild(this.renderer.domElement)

    const sky = this.track(skyTexture())
    this.scene.background = sky
    this.scene.fog = new Fog(new Color('#2B2F55'), 30, 80)
    this.scene.add(new HemisphereLight(0xb8c4ff, 0x2a3a2a, 0.9), new AmbientLight(0xffffff, 0.2))

    const moon = new DirectionalLight(0xdfe6ff, 1.4)
    moon.position.set(-10, 24, 8)
    moon.castShadow = true
    moon.shadow.mapSize.set(2048, 2048)
    Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 })
    moon.shadow.bias = -0.0008
    this.scene.add(moon)

    this.clash = new Clash(this.scene, CLASH)

    this.resizeObserver = new ResizeObserver(() => { this.resize(host) })
    this.resizeObserver.observe(host)
    this.resize(host)
  }

  /** Who is fighting, and which of them is this player (null for someone watching). */
  setRoster(players: readonly RoundPlayerView[], selfPlayerId: string | null): void {
    for (const entry of this.entries) this.removeEntry(entry)
    this.radius = circleRadius(players.length)
    this.buildArena()

    // This player stands nearest the camera's starting side, the rest round the circle in roster order.
    const selfIndex = Math.max(0, players.findIndex(({ playerId }) => playerId === selfPlayerId))
    this.entries = players.map((player, index) => {
      const seat = (index - selfIndex + players.length) % players.length
      const angle = Math.PI / 2 + (seat / players.length) * Math.PI * 2
      const badge = createAvatarTexture({ initial: player.initial, color: player.color, seed: player.avatar })
      const mage = new Mage(player.color, badge)
      mage.root.position.set(Math.cos(angle) * this.radius, 0, Math.sin(angle) * this.radius)
      // Built facing +x; turning by y = π − angle points it at the middle.
      mage.root.rotation.y = Math.PI - angle
      const beam = new SpellBeam(player.color)
      const tag = new ScoreTag()
      this.scene.add(mage.root, beam.mesh, tag.sprite)
      return {
        player, mage, beam, tag, badge, angle, turn: seat, isSelf: player.playerId === selfPlayerId,
        strength: 0, surge: 0, sputter: 0, hasFired: false, hasArrived: false, color: new Color(player.color),
      }
    })
  }

  /** A spell landed for this mage: their beam surges and a shockwave rolls out of the clash. */
  spellLanded(playerId: string, points: number): void {
    const entry = this.entries.find(({ player }) => player.playerId === playerId)
    if (entry === undefined) return
    entry.surge = SURGE_SECONDS
    entry.mage.thrustWand()
    this.clash.burst(entry.player.color, points)
    this.shake = Math.max(this.shake, 0.25 + points * 0.12)
  }

  /** A spell fizzled for this mage: their beam sputters and they are knocked back a step. */
  spellFizzled(playerId: string): void {
    const entry = this.entries.find(({ player }) => player.playerId === playerId)
    if (entry === undefined) return
    entry.sputter = SPUTTER_SECONDS
    entry.mage.stagger()
  }

  render(frame: BattleFrame): void {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05)
    this.seconds += deltaSeconds
    const sinceStartMs = this.seconds * 1000
    const views = new Map(frame.mages.map((view) => [view.playerId, view]))

    let active = 0
    this.feeding.length = 0
    for (const entry of this.entries) {
      const view = views.get(entry.player.playerId)
      const pose = view?.pose ?? 'idle'
      entry.mage.update(pose, deltaSeconds)
      entry.surge = Math.max(0, entry.surge - deltaSeconds)
      entry.sputter = Math.max(0, entry.sputter - deltaSeconds)

      // Each in turn gathers a spell at the wand's tip, then fires: the beam shoots out to the middle and holds there.
      const firesAtMs = BEAM_FIRST_FIRES_MS + entry.turn * BEAM_STAGGER_MS
      const charge = (sinceStartMs - (firesAtMs - CHARGE_MS)) / CHARGE_MS
      entry.mage.setCharge(charge < 1 ? charge : 0)
      if (!entry.hasFired && sinceStartMs >= firesAtMs) {
        entry.hasFired = true
        entry.surge = SURGE_SECONDS
        entry.mage.thrustWand()
      }
      const grown = (sinceStartMs - firesAtMs) / BEAM_GROW_MS
      const reach = 1 - (1 - Math.min(1, Math.max(0, grown))) ** 3
      if (!entry.hasArrived && reach >= 1) {
        entry.hasArrived = true
        this.clash.burst(entry.player.color, 2)
      }
      const might = view?.might ?? 1
      const wanted = pose === 'casting' || pose === 'idle' ? 0.55 + 0.45 * might : 0
      entry.strength += (wanted - entry.strength) * (1 - Math.exp(-6 * deltaSeconds))
      const surge = entry.surge / SURGE_SECONDS
      const sputter = entry.sputter > 0 ? 0.25 + 0.35 * Math.abs(Math.sin(this.seconds * 40)) : 1
      const strength = (entry.strength + surge * 1.1) * sputter
      const radius = 0.06 + 0.07 * might + surge * 0.09
      entry.mage.tipPosition(this.tip)
      entry.beam.update(this.tip, CLASH, reach, radius, strength, this.seconds)
      if (reach > 0.99 && strength > 0.05) {
        active += strength
        this.feeding.push(entry.color)
      }

      // Name and score over their head.
      entry.tag.sprite.position.set(entry.mage.root.position.x, NAMEPLATE_LIFT, entry.mage.root.position.z)
      entry.tag.update({
        name: entry.player.name,
        score: view === undefined ? '' : String(view.score),
        isYou: view?.isSelf ?? false,
        isFaded: pose === 'out',
      })
    }

    this.updateTags()
    this.updateCamera(frame, deltaSeconds)
    this.clash.update(active, this.feeding, deltaSeconds, this.camera.position)
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.resizeObserver.disconnect()
    for (const entry of this.entries) this.removeEntry(entry)
    this.clash.dispose()
    this.disposables.forEach((item) => { item.dispose() })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  /* ---------------- building ---------------- */

  private arenaBuilt = false

  /** The duelling ground: a clearing of grass, a glowing rune circle under the mages, and old standing stones round it. */
  private buildArena(): void {
    if (this.arenaBuilt) return
    this.arenaBuilt = true
    const ground = new Mesh(
      this.track(new CircleGeometry(70, 48)),
      this.track(new MeshStandardMaterial({ color: 0x34503a, roughness: 0.95 })),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    const clearing = new Mesh(
      this.track(new CircleGeometry(this.radius + 2.2, 64)),
      this.track(new MeshStandardMaterial({ color: 0x55704a, roughness: 0.9 })),
    )
    clearing.rotation.x = -Math.PI / 2
    clearing.position.y = 0.01
    clearing.receiveShadow = true
    const rune = new Mesh(
      this.track(new RingGeometry(this.radius - 0.25, this.radius + 0.25, 96)),
      this.track(new MeshBasicMaterial({ color: 0x8f7bff, transparent: true, opacity: 0.45, blending: AdditiveBlending, depthWrite: false })),
    )
    rune.rotation.x = -Math.PI / 2
    rune.position.y = 0.03
    const inner = new Mesh(
      this.track(new RingGeometry(1.2, 1.35, 64)),
      this.track(new MeshBasicMaterial({ color: 0xc7b8ff, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false })),
    )
    inner.rotation.x = -Math.PI / 2
    inner.position.y = 0.03
    this.scene.add(ground, clearing, rune, inner)

    // Standing stones, leaning a little, at fixed spots so every screen has the same circle.
    const stone = this.track(new MeshStandardMaterial({ color: 0x8a8f9a, roughness: 1 }))
    const block = this.track(new BoxGeometry(1, 1, 1))
    const count = 16
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2 + 0.2
      const distance = this.radius + 5 + (index % 3) * 1.4
      const height = 1.8 + ((index * 7) % 5) * 0.55
      const mesh = new Mesh(block, stone)
      mesh.scale.set(1.1, height, 0.7)
      mesh.position.set(Math.cos(angle) * distance, height / 2 - 0.1, Math.sin(angle) * distance)
      mesh.rotation.set(((index % 4) - 1.5) * 0.06, -angle, ((index % 5) - 2) * 0.05)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.scene.add(mesh)
    }
  }

  /* ---------------- frame ---------------- */

  private updateTags(): void {
    const canvasHeight = this.renderer.domElement.clientHeight || 1
    const pixels = Math.min(NAMEPLATE_PIXELS, Math.max(NAMEPLATE_MIN_PIXELS, canvasHeight * NAMEPLATE_SHARE_OF_HEIGHT))
    const width = labelWidthFor(pixels, canvasHeight, FIELD_OF_VIEW)
    for (const entry of this.entries) entry.tag.setWidth(width)
  }

  private updateCamera(frame: BattleFrame, deltaSeconds: number): void {
    const self = this.entries.find(({ isSelf }) => isSelf)
    const wantsShoulder = frame.focusOnSelf && self !== undefined
    this.rise = Math.min(1, Math.max(0, this.rise + (frame.isOpening ? -1 : 1) * RISE_PER_SECOND * deltaSeconds))
    const rise = smoothstep(this.rise)

    // Circling the arena from beyond the standing stones; higher still for a watcher once it starts.
    // For a player, timed so that when the flight is due it is FLIGHT_TURN short of their shoulder.
    const shoulderAngle = self?.angle ?? 0
    const orbitAngle =
      self !== undefined && frame.secondsToFlight !== null
        ? shoulderAngle - FLIGHT_TURN - frame.secondsToFlight * ORBIT_PER_SECOND
        : shoulderAngle + Math.PI * 0.75 + this.seconds * ORBIT_PER_SECOND
    const orbitDistance = this.radius + OPENING_BACK
    const orbitHeight = OPENING_HEIGHT + 0.6 * Math.sin(this.seconds * 0.5) + rise * (this.radius * 0.8 + 3)
    this.overTarget.set(0, CLASH.y + OPENING_LOOK_LIFT * (1 - rise), 0)

    // A steady flight at a fixed pace rather than a chase that slows forever.
    const wasFlying = this.flight > 0
    this.flight = Math.min(1, Math.max(0, this.flight + (wantsShoulder ? 1 : -1) * (deltaSeconds / CAMERA_FLIGHT_SECONDS)))
    if (this.flight === 0) this.flightFrom = null
    // Setting off for the shoulder: from where the circle was the moment the flight began (part of this frame ago), on round the way it was turning, never back.
    if (wantsShoulder && !wasFlying) {
      const from = orbitAngle - ORBIT_PER_SECOND * this.flight * CAMERA_FLIGHT_SECONDS
      let turn = (((shoulderAngle - from) % TAU) + TAU) % TAU
      // Only just past it (a late start): a touch back rather than all the way round again.
      if (turn > TAU * 0.875) turn -= TAU
      this.flightFrom = { angle: from, turn }
    }
    const t = smoothstep(this.flight)

    let angle: number
    if (wantsShoulder && this.flightFrom !== null) {
      // Leaves at the circle's own speed and comes to rest on the shoulder (a Hermite curve: that speed at the start, none at the end).
      const f = this.flight
      const startSpeed = ORBIT_PER_SECOND * CAMERA_FLIGHT_SECONDS
      angle = this.flightFrom.angle + (f * f * f - 2 * f * f + f) * startSpeed + (3 * f * f - 2 * f * f * f) * this.flightFrom.turn
    } else {
      // Back out to the circle (knocked out): round the shorter way.
      let sweep = (shoulderAngle - orbitAngle) % TAU
      if (sweep > Math.PI) sweep -= TAU
      if (sweep < -Math.PI) sweep += TAU
      angle = orbitAngle + sweep * t
    }
    const distance = orbitDistance + (this.radius + SHOULDER_BACK - orbitDistance) * t
    const height = orbitHeight + (SHOULDER_HEIGHT - orbitHeight) * t
    this.eye.set(Math.cos(angle) * distance, height, Math.sin(angle) * distance)
    this.target.lerpVectors(this.overTarget, CLASH, t)

    this.shake = Math.max(0, this.shake - SHAKE_DECAY_PER_SECOND * deltaSeconds)
    const rattle = this.shake * this.shake * 0.3
    this.camera.position.set(
      this.eye.x + (Math.random() - 0.5) * rattle,
      this.eye.y + (Math.random() - 0.5) * rattle,
      this.eye.z + (Math.random() - 0.5) * rattle,
    )
    this.camera.lookAt(this.target)
  }

  private resize(host: HTMLElement): void {
    const width = host.clientWidth || 1
    const height = host.clientHeight || 1
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item)
    return item
  }

  private removeEntry(entry: Entry): void {
    this.scene.remove(entry.mage.root, entry.beam.mesh, entry.tag.sprite)
    entry.mage.dispose()
    entry.beam.dispose()
    entry.tag.dispose()
    entry.badge.dispose()
  }
}
