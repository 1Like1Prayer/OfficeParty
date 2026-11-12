import {
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  Clock,
} from 'three'
import { MINEFIELD } from '../../../shared/games/minefield/constants.ts'
import type { MinefieldMap } from '../../../shared/games/minefield/types.ts'
import type { RoundPlayerView } from '../../../types/index.ts'
import { createAvatarTexture } from '../../three/avatarTexture.ts'
import { labelWidthFor, Nameplate } from '../../three/Nameplate.ts'
import { zoomProgress } from '../../LogDodge/scene/cameraPath.ts'
import type { Blast, FieldFrame, Racer, ScanPulse } from '../fieldFrame.ts'
import { Runner } from './Runner.ts'
import { World } from './World.ts'

const FIELD_OF_VIEW = 50
const HORIZON = '#f3e2b8'
const NAMEPLATE_PIXELS = 96
const NAMEPLATE_HEIGHT = 2.5

/** The follow camera: high above and a little behind, looking ahead of the runner — top down, tilted. */
const FOLLOW = { OFFSET: new Vector3(-2, 22, 11.5), LOOK: new Vector3(4.5, 0, -0.8) }
const SHAKE_DECAY_PER_SECOND = 5

export interface MinefieldSetup {
  map: MinefieldMap
  timingStartsAtLocalMs: number
  selfPlayerId: string
  /** World units per tile; see `tileScaleFor`. */
  tileScale: number
}

interface Entry {
  player: RoundPlayerView
  runner: Runner
  nameplate: Nameplate
  badge: CanvasTexture
}

interface BlastEffect {
  group: Group
  fire: Mesh
  ring: Mesh
  sparks: Mesh[]
}

interface ScanEffect {
  rings: Mesh[]
  reveal: Mesh
}

const easeOutBack = (t: number): number => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

function skyTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#5fb4ee')
  gradient.addColorStop(0.55, '#a9dbf5')
  gradient.addColorStop(1, HORIZON)
  context.fillStyle = gradient
  context.fillRect(0, 0, 4, 256)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * The minefield as a 3D desert. It opens high above the finish line looking
 * back over the whole field to the runners, then swoops in behind the player
 * and settles into a tilted top-down view that follows them. Mines only exist
 * on screen while a sonar pulse is showing them, and are drawn with the very
 * circle that sets them off.
 */
export class MinefieldScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.5, 600)
  private readonly clock = new Clock()
  private readonly world: World
  private readonly sun = new DirectionalLight(0xfff0d0, 2.8)
  private readonly resizeObserver: ResizeObserver
  private readonly setup: MinefieldSetup
  private readonly disposables: { dispose: () => void }[] = []

  private entries: Entry[] = []
  private frame: FieldFrame | null = null
  private labelWidth = 1
  private readonly viewScale: number

  /* mines */
  private readonly mineMarks: Group[] = []
  private readonly mineShownAt: (number | null)[] = []
  private readonly craters: Mesh[] = []
  private readonly mineLight = new MeshBasicMaterial({ color: 0xff5a4d })
  private readonly dangerFill = new MeshBasicMaterial({ color: 0xe24040, transparent: true, opacity: 0.2, depthWrite: false })
  private readonly dangerEdge = new MeshBasicMaterial({ color: 0xc82828, transparent: true, opacity: 0.8, depthWrite: false })

  /* effects */
  private readonly blastEffects = new Map<string, BlastEffect>()
  private readonly scanEffects = new Map<string, ScanEffect>()

  /* camera */
  private readonly focus = new Vector3()
  private hasFocus = false
  private pull = 1
  private shake = 0
  private readonly cameraPosition = new Vector3()
  private readonly cameraTarget = new Vector3()
  private readonly overviewPosition: Vector3
  private readonly overviewTarget: Vector3

  constructor(host: HTMLElement, setup: MinefieldSetup) {
    this.setup = setup
    const { map, tileScale } = setup
    // The view grows more slowly than the tiles do, so a spread-out field is still easy to read.
    this.viewScale = Math.pow(tileScale, 0.8)
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0' })
    host.appendChild(this.renderer.domElement)

    const sky = skyTexture()
    this.disposables.push(sky)
    this.scene.background = sky
    this.scene.fog = new Fog(new Color(HORIZON), 70 * this.viewScale, 250 * this.viewScale)

    this.scene.add(new HemisphereLight(0xfff4d6, 0xd2b078, 1.15), new AmbientLight(0xffffff, 0.25))
    this.sun.position.set(-18, 40, 22)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const shadow = this.sun.shadow.camera
    const reach = 26 * this.viewScale
    shadow.left = -reach
    shadow.right = reach
    shadow.top = reach
    shadow.bottom = -reach
    shadow.near = 5
    shadow.far = 120 * this.viewScale
    this.sun.shadow.bias = -0.0006
    this.scene.add(this.sun, this.sun.target)

    this.world = new World(map, tileScale)
    this.scene.add(this.world.group)
    this.buildMines(map)

    // High beyond the finish line, looking back down the field at the runners.
    const { viewScale } = this
    this.overviewPosition = new Vector3((map.width + 9) * tileScale, 25 * viewScale, (map.height / 2) * tileScale)
    this.overviewTarget = new Vector3(11 * tileScale, 0, (map.height / 2) * tileScale)

    this.resizeObserver = new ResizeObserver(() => { this.resize(host) })
    this.resizeObserver.observe(host)
    this.resize(host)
    this.renderer.setAnimationLoop(() => { this.renderFrame() })
  }

  /** Who is racing. Call again if the field changes. */
  setRoster(players: readonly RoundPlayerView[]): void {
    for (const entry of this.entries) this.removeEntry(entry)
    this.entries = players.map((player) => {
      const badge = createAvatarTexture({ initial: player.initial, color: player.color, seed: player.avatar })
      const runner = new Runner(player.color, badge)
      const nameplate = new Nameplate()
      nameplate.setWidth(this.labelWidth)
      this.scene.add(runner.root, nameplate.sprite)
      return { player, runner, nameplate, badge }
    })
  }

  /** The latest state of the field. Cheap to call on every React render. */
  setFrame(frame: FieldFrame): void {
    this.frame = frame
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    for (const entry of this.entries) this.removeEntry(entry)
    for (const key of [...this.blastEffects.keys()]) this.removeBlast(key)
    for (const key of [...this.scanEffects.keys()]) this.removeScan(key)
    this.world.dispose()
    this.disposables.forEach((item) => { item.dispose() })
    this.mineLight.dispose()
    this.dangerFill.dispose()
    this.dangerEdge.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  /* ---------------- building ---------------- */

  private buildMines(map: MinefieldMap): void {
    const casing = new MeshStandardMaterial({ color: 0x2e2a45, roughness: 0.5, metalness: 0.4 })
    const crater = new MeshBasicMaterial({ color: 0x2e2a45, transparent: true, opacity: 0.3, depthWrite: false })
    const discGeometry = new CylinderGeometry(0.28, 0.32, 0.14, 16)
    const lightGeometry = new SphereGeometry(0.1, 10, 8)
    // The danger circle is in tiles, so it grows with them.
    const { tileScale } = this.setup
    const radius = MINEFIELD.TRIGGER_RADIUS * tileScale
    const fillGeometry = new CircleGeometry(radius, 40)
    const edgeGeometry = new RingGeometry(radius - 0.04 * tileScale, radius, 48)
    const craterGeometry = new CircleGeometry(0.55, 20)
    this.disposables.push(casing, crater, discGeometry, lightGeometry, fillGeometry, edgeGeometry, craterGeometry)

    for (const mine of map.mines) {
      const mark = new Group()
      mark.position.set(mine.x * tileScale, 0, mine.y * tileScale)
      const fill = new Mesh(fillGeometry, this.dangerFill)
      fill.rotation.x = -Math.PI / 2
      fill.position.y = 0.03
      const edge = new Mesh(edgeGeometry, this.dangerEdge)
      edge.rotation.x = -Math.PI / 2
      edge.position.y = 0.035
      const disc = new Mesh(discGeometry, casing)
      disc.position.y = 0.07
      disc.castShadow = true
      const light = new Mesh(lightGeometry, this.mineLight)
      light.position.y = 0.17
      mark.add(fill, edge, disc, light)
      mark.visible = false
      this.scene.add(mark)
      this.mineMarks.push(mark)
      this.mineShownAt.push(null)

      const scorch = new Mesh(craterGeometry, crater)
      scorch.rotation.x = -Math.PI / 2
      scorch.position.set(mine.x * tileScale, 0.025, mine.y * tileScale)
      scorch.scale.setScalar(Math.sqrt(tileScale))
      scorch.visible = false
      this.scene.add(scorch)
      this.craters.push(scorch)
    }
  }

  /* ---------------- frame ---------------- */

  private renderFrame(): void {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05)
    const nowMs = performance.now() - this.setup.timingStartsAtLocalMs
    const frame = this.frame
    if (frame === null) {
      this.renderer.render(this.scene, this.camera)
      return
    }

    this.updateMines(frame, nowMs)
    this.updateEffects(frame, nowMs)
    this.updateRacers(frame, deltaSeconds, nowMs)
    this.updateCamera(frame, nowMs, deltaSeconds)
    this.renderer.render(this.scene, this.camera)
  }

  private updateMines(frame: FieldFrame, nowMs: number): void {
    const showing = new Set(frame.revealed)
    const pulse = 0.5 + 0.5 * Math.sin(nowMs / 140)
    this.dangerFill.opacity = 0.16 + 0.1 * pulse
    this.mineLight.color.set(pulse > 0.5 ? 0xff5a4d : 0x7a2a2a)

    for (const [index, mark] of this.mineMarks.entries()) {
      if (showing.has(index)) {
        const shownAt = this.mineShownAt[index] ?? nowMs
        this.mineShownAt[index] = shownAt
        mark.visible = true
        // Pops up out of the sand when a scan finds it.
        mark.scale.setScalar(Math.max(0.001, easeOutBack(Math.min(1, (nowMs - shownAt) / 280))))
      } else {
        this.mineShownAt[index] = null
        mark.visible = false
      }
    }
    const gone = new Set(frame.gone)
    for (const [index, crater] of this.craters.entries()) crater.visible = gone.has(index)
  }

  private updateEffects(frame: FieldFrame, nowMs: number): void {
    // Explosions.
    const blastKeys = new Set<string>()
    for (const blast of frame.blasts) {
      const age = nowMs - blast.atMs
      if (age > MINEFIELD.EXPLOSION_ANIMATION_MS) continue
      const key = `${blast.atMs}:${blast.x}:${blast.y}`
      blastKeys.add(key)
      let effect = this.blastEffects.get(key)
      if (effect === undefined) {
        effect = this.createBlast(blast)
        this.blastEffects.set(key, effect)
        const self = frame.racers.find((racer) => racer.isSelf)
        if (self !== undefined && Math.hypot(self.x - blast.x, self.y - blast.y) < 2) this.shake = 1
      }
      this.poseBlast(effect, Math.max(0, age) / MINEFIELD.EXPLOSION_ANIMATION_MS)
    }
    for (const key of [...this.blastEffects.keys()]) if (!blastKeys.has(key)) this.removeBlast(key)

    // Sonar pulses, then the circle left showing what they found.
    const scanKeys = new Set<string>()
    const total = MINEFIELD.SONAR_ANIMATION_MS + MINEFIELD.SONAR_REVEAL_MS
    for (const scan of frame.scans) {
      const age = nowMs - scan.atMs
      if (age < 0 || age > total) continue
      const key = `${scan.atMs}:${scan.x}:${scan.y}`
      scanKeys.add(key)
      let effect = this.scanEffects.get(key)
      if (effect === undefined) {
        effect = this.createScan(scan)
        this.scanEffects.set(key, effect)
      }
      this.poseScan(effect, age)
    }
    for (const key of [...this.scanEffects.keys()]) if (!scanKeys.has(key)) this.removeScan(key)
  }

  private updateRacers(frame: FieldFrame, deltaSeconds: number, nowMs: number): void {
    const canvasHeight = this.renderer.domElement.clientHeight || 1
    this.labelWidth = labelWidthFor(NAMEPLATE_PIXELS, canvasHeight, FIELD_OF_VIEW)
    const byId = new Map(frame.racers.map((racer) => [racer.playerId, racer]))

    for (const entry of this.entries) {
      const racer = byId.get(entry.player.playerId)
      if (racer === undefined) {
        entry.runner.root.visible = false
        entry.nameplate.sprite.visible = false
        continue
      }
      const { tileScale } = this.setup
      entry.runner.update(
        { ...racer, x: racer.x * tileScale, y: racer.y * tileScale },
        deltaSeconds,
        nowMs,
        tileScale,
      )
      const { position } = entry.runner.root
      entry.nameplate.setWidth(this.labelWidth)
      // From far above the tags would pile on top of each other, so rivals' appear as the camera comes down.
      entry.nameplate.setOpacity(racer.isSelf ? 1 : zoomProgress(nowMs))
      entry.nameplate.sprite.position.set(position.x, NAMEPLATE_HEIGHT, position.z)
      entry.nameplate.update({
        name: entry.player.name,
        score: racer.lives,
        unit: '♥',
        status: racer.state === 'out' ? 'OUT' : racer.state === 'won' ? 'WINNER!' : '',
        isYou: racer.isSelf,
        isFallen: racer.state === 'out',
      })
    }
  }

  private updateCamera(frame: FieldFrame, nowMs: number, deltaSeconds: number): void {
    // Who the camera is on: the player, or while they are out the runner furthest ahead.
    const self = frame.racers.find((racer) => racer.isSelf)
    const leader = frame.racers
      .filter((racer) => racer.state !== 'out')
      .reduce<Racer | null>((best, racer) => (best === null || racer.x > best.x ? racer : best), null)
    const subject = self !== undefined && self.state !== 'out' ? self : (leader ?? self)
    if (subject !== undefined) {
      const target = new Vector3(subject.x * this.setup.tileScale, 0, subject.y * this.setup.tileScale)
      if (!this.hasFocus) {
        this.focus.copy(target)
        this.hasFocus = true
      } else {
        this.focus.lerp(target, 1 - Math.exp(-(subject === self ? 12 : 3) * deltaSeconds))
      }
    } else if (!this.hasFocus) {
      this.focus.set(
        this.setup.map.startX * this.setup.tileScale,
        0,
        this.setup.map.startY * this.setup.tileScale,
      )
    }

    // Pulled back once the player is out or the race is decided, to take in the field.
    const wantsPull = self?.state === 'out' || frame.isRaceOver ? 1.5 : 1
    this.pull += (wantsPull - this.pull) * (1 - Math.exp(-2 * deltaSeconds))

    // The opening swoop is a function of the clock, so a late mount still lands where it should.
    const blend = zoomProgress(nowMs)
    const followPosition = new Vector3().copy(this.focus).addScaledVector(FOLLOW.OFFSET, this.pull * this.viewScale)
    const followTarget = new Vector3().copy(this.focus).addScaledVector(FOLLOW.LOOK, this.pull * this.viewScale)
    this.cameraPosition.lerpVectors(this.overviewPosition, followPosition, blend)
    this.cameraTarget.lerpVectors(this.overviewTarget, followTarget, blend)
    // Sweeps in on an arc rather than a straight line, so it feels like it is flying.
    this.cameraPosition.y += Math.sin(Math.PI * blend) * 8 * this.viewScale

    this.shake = Math.max(0, this.shake - SHAKE_DECAY_PER_SECOND * deltaSeconds)
    const rattle = this.shake * this.shake * 0.35
    this.camera.position.set(
      this.cameraPosition.x + (Math.random() - 0.5) * rattle,
      this.cameraPosition.y + (Math.random() - 0.5) * rattle,
      this.cameraPosition.z + (Math.random() - 0.5) * rattle,
    )
    this.camera.lookAt(this.cameraTarget)

    // The sun's shadow follows the action.
    this.sun.target.position.copy(this.focus)
    this.sun.position.set(this.focus.x - 18 * this.viewScale, 40 * this.viewScale, this.focus.z + 22 * this.viewScale)
  }

  /* ---------------- effects ---------------- */

  private createBlast(blast: Blast): BlastEffect {
    const group = new Group()
    const { tileScale } = this.setup
    group.position.set(blast.x * tileScale, 0, blast.y * tileScale)
    const fire = new Mesh(
      new SphereGeometry(1, 20, 14),
      new MeshBasicMaterial({ color: 0xffa030, transparent: true, depthWrite: false }),
    )
    const ring = new Mesh(
      new RingGeometry(0.9, 1, 40),
      new MeshBasicMaterial({ color: 0xfff0c0, transparent: true, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.05
    const sparkGeometry = new SphereGeometry(0.09, 6, 5)
    const sparkMaterial = new MeshBasicMaterial({ color: 0xffd25a, transparent: true })
    const sparks = Array.from({ length: 14 }, () => new Mesh(sparkGeometry, sparkMaterial))
    group.add(fire, ring, ...sparks)
    this.scene.add(group)
    return { group, fire, ring, sparks }
  }

  private poseBlast(effect: BlastEffect, progress: number): void {
    const fade = 1 - progress
    const radius = MINEFIELD.TRIGGER_RADIUS * this.setup.tileScale * (0.4 + 1.4 * Math.sqrt(progress))
    effect.fire.scale.setScalar(radius)
    effect.fire.position.y = radius * 0.6
    ;(effect.fire.material as MeshBasicMaterial).opacity = 0.9 * fade
    ;(effect.fire.material as MeshBasicMaterial).color.setHSL(0.09 - 0.07 * progress, 1, 0.55 + 0.25 * fade)
    effect.ring.scale.setScalar(MINEFIELD.TRIGGER_RADIUS * this.setup.tileScale * (0.5 + 2.4 * progress))
    ;(effect.ring.material as MeshBasicMaterial).opacity = 0.8 * fade
    for (const [index, spark] of effect.sparks.entries()) {
      const angle = index * 2.4
      const speed = 1.8 + (index % 4) * 0.5
      spark.position.set(
        Math.cos(angle) * speed * progress,
        0.4 + (2.6 + (index % 3)) * progress - 4.5 * progress * progress,
        Math.sin(angle) * speed * progress,
      )
    }
    ;(effect.sparks[0]!.material as MeshBasicMaterial).opacity = fade
  }

  private removeBlast(key: string): void {
    const effect = this.blastEffects.get(key)
    if (effect === undefined) return
    this.scene.remove(effect.group)
    effect.fire.geometry.dispose()
    ;(effect.fire.material as MeshBasicMaterial).dispose()
    effect.ring.geometry.dispose()
    ;(effect.ring.material as MeshBasicMaterial).dispose()
    effect.sparks[0]!.geometry.dispose()
    ;(effect.sparks[0]!.material as MeshBasicMaterial).dispose()
    this.blastEffects.delete(key)
  }

  private createScan(scan: ScanPulse): ScanEffect {
    const geometry = new RingGeometry(0.97, 1, 64)
    const rings = [0, 1].map(() => {
      const ring = new Mesh(
        geometry,
        new MeshBasicMaterial({ color: 0x28a0d2, transparent: true, depthWrite: false }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.set(scan.x * this.setup.tileScale, 0.06, scan.y * this.setup.tileScale)
      this.scene.add(ring)
      return ring
    })
    const reveal = new Mesh(
      geometry,
      new MeshBasicMaterial({ color: 0x28a0d2, transparent: true, depthWrite: false }),
    )
    reveal.rotation.x = -Math.PI / 2
    reveal.position.set(scan.x * this.setup.tileScale, 0.05, scan.y * this.setup.tileScale)
    reveal.scale.setScalar(MINEFIELD.SONAR_RADIUS * this.setup.tileScale)
    this.scene.add(reveal)
    return { rings, reveal }
  }

  private poseScan(effect: ScanEffect, ageMs: number): void {
    const animating = ageMs < MINEFIELD.SONAR_ANIMATION_MS
    const progress = Math.min(1, ageMs / MINEFIELD.SONAR_ANIMATION_MS)
    for (const [index, ring] of effect.rings.entries()) {
      const own = Math.min(1, Math.max(0, progress - index * 0.3) / (1 - index * 0.3))
      ring.visible = animating && own > 0
      ring.scale.setScalar(Math.max(0.01, MINEFIELD.SONAR_RADIUS * this.setup.tileScale * own))
      ;(ring.material as MeshBasicMaterial).opacity = 0.85 * (1 - own)
    }
    // The ring left behind while what it found is still showing.
    effect.reveal.visible = !animating
    const left = 1 - (ageMs - MINEFIELD.SONAR_ANIMATION_MS) / MINEFIELD.SONAR_REVEAL_MS
    ;(effect.reveal.material as MeshBasicMaterial).opacity = 0.4 * Math.max(0, left)
  }

  private removeScan(key: string): void {
    const effect = this.scanEffects.get(key)
    if (effect === undefined) return
    for (const ring of [...effect.rings, effect.reveal]) {
      this.scene.remove(ring)
      ;(ring.material as MeshBasicMaterial).dispose()
    }
    effect.reveal.geometry.dispose()
    this.scanEffects.delete(key)
  }

  /* ---------------- housekeeping ---------------- */

  private resize(host: HTMLElement): void {
    const { clientWidth: width, clientHeight: height } = host
    if (width === 0 || height === 0) return
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.fov = FIELD_OF_VIEW
    this.camera.updateProjectionMatrix()
  }

  private removeEntry(entry: Entry): void {
    this.scene.remove(entry.runner.root, entry.nameplate.sprite)
    entry.runner.dispose()
    entry.nameplate.dispose()
    entry.badge.dispose()
  }
}
