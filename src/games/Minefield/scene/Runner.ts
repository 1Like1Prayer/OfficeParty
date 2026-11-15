import {
  CapsuleGeometry,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  BoxGeometry,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three'
import type { Racer } from '../fieldFrame.ts'

const CONFETTI_COLORS = [0xff5fa2, 0xffd24a, 0x5ad1a0, 0x5aa9ff]
const CONFETTI_COUNT = 16

const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt)
const shortestAngle = (from: number, to: number): number => {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

/**
 * A little low-poly runner seen from above and behind: capsule body, round
 * head, swinging arms and legs, with their avatar as a badge on the back.
 * It follows the position it is given, runs while it is moving, and acts out
 * the moments of the race: a blast throwing it up, the sonar scan, being
 * knocked out, and the win.
 */
export class Runner {
  readonly root = new Group()
  private readonly body = new Group()
  private readonly legs: [Group, Group] = [new Group(), new Group()]
  private readonly arms: [Group, Group] = [new Group(), new Group()]
  private readonly shirt: MeshStandardMaterial
  private readonly confetti: Mesh[] = []
  private readonly disposables: { dispose: () => void }[] = []

  private stride = Math.random() * 6
  private yaw = 0
  private explodeClock = 0
  private outClock = 0
  private wonClock = 0
  private scanClock = 0
  private hasSoot = false
  private placed = false

  constructor(color: string, badge: Texture) {
    this.shirt = this.track(new MeshStandardMaterial({ color, roughness: 0.6 }))
    const skin = this.track(new MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.7 }))
    const trousers = this.track(new MeshStandardMaterial({ color: 0x4a5a78, roughness: 0.8 }))
    const hairMaterial = this.track(new MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.8 }))

    this.root.add(this.body)
    // A touch bigger than a tile's worth of person, so they read from up here.
    this.root.scale.setScalar(1.3)
    this.add(this.body, new CapsuleGeometry(0.24, 0.42, 6, 12), this.shirt, 0, 0.82, 0)
    this.add(this.body, new SphereGeometry(0.23, 16, 12), skin, 0, 1.4, 0)
    const hair = this.add(
      this.body,
      new SphereGeometry(0.245, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMaterial,
      0,
      1.43,
      0,
    )
    hair.rotation.z = 0.25

    // The badge faces backwards (-x), towards the camera that follows them.
    const badgeMaterial = this.track(new MeshBasicMaterial({ map: badge, transparent: true }))
    const badgeMesh = new Mesh(this.track(new CircleGeometry(0.19, 24)), badgeMaterial)
    badgeMesh.position.set(-0.245, 0.85, 0)
    badgeMesh.rotation.y = -Math.PI / 2
    this.body.add(badgeMesh)

    ;([-1, 1] as const).forEach((side, index) => {
      const leg = this.legs[index]!
      leg.position.set(0, 0.55, side * 0.13)
      this.add(leg, new CapsuleGeometry(0.09, 0.34, 4, 8), trousers, 0, -0.26, 0)
      this.body.add(leg)

      const arm = this.arms[index]!
      arm.position.set(0, 1.08, side * 0.33)
      this.add(arm, new CapsuleGeometry(0.075, 0.3, 4, 8), this.shirt, 0, -0.2, 0)
      this.body.add(arm)
    })

    this.root.traverse((object) => { object.castShadow = true })

    const piece = this.track(new BoxGeometry(0.14, 0.04, 0.14))
    for (let index = 0; index < CONFETTI_COUNT; index++) {
      const mesh = new Mesh(
        piece,
        this.track(new MeshBasicMaterial({ color: CONFETTI_COLORS[index % CONFETTI_COLORS.length]! })),
      )
      mesh.visible = false
      this.confetti.push(mesh)
      this.root.add(mesh)
    }
  }

  /**
   * Stands at `racer`'s position (in world units) and plays what they are
   * doing. `vx`/`vy` are their speed in tiles per millisecond. `nowMs` is the
   * round clock.
   */
  update(racer: Racer, deltaSeconds: number, nowMs: number): void {
    const { root, body } = this
    if (!this.placed || racer.isSelf) {
      root.position.set(racer.x, 0, racer.y)
      this.placed = true
    } else {
      // A rival's path is already smooth; this only softens the small jump when
      // a late report puts them somewhere a little different from where they
      // were being carried on to.
      const follow = damp(25, deltaSeconds)
      root.position.x += (racer.x - root.position.x) * follow
      root.position.z += (racer.y - root.position.z) * follow
    }
    // In tiles per second, from the race itself rather than from how far the
    // model happened to move this frame, so the stride never flickers.
    const speed = Math.hypot(racer.vx, racer.vy) * 1000
    const isRunning = racer.state === 'racing' && speed > 0.6

    // The direction pressed, when known, turns the runner even standing still or
    // after a quick tap; otherwise they face the way they are going.
    const facing = racer.facing
    const canTurn = racer.state === 'racing' || racer.state === 'scanning'
    if (facing && (facing.x !== 0 || facing.y !== 0) && canTurn) {
      this.yaw += shortestAngle(this.yaw, Math.atan2(-facing.y, facing.x)) * damp(18, deltaSeconds)
    } else if (isRunning) {
      this.yaw += shortestAngle(this.yaw, Math.atan2(-racer.vy, racer.vx)) * damp(14, deltaSeconds)
    }
    root.rotation.y = this.yaw

    this.explodeClock = racer.state === 'exploding' ? this.explodeClock + deltaSeconds : 0
    this.scanClock = racer.state === 'scanning' ? this.scanClock + deltaSeconds : 0
    this.outClock = racer.state === 'out' ? this.outClock + deltaSeconds : 0
    this.wonClock = racer.state === 'won' ? this.wonClock + deltaSeconds : 0

    // The default pose, then whatever the moment calls for.
    this.stride += (isRunning ? Math.min(speed, 5) * 2.4 : 0) * deltaSeconds
    const swing = isRunning ? Math.min(1, speed / 3) * 0.9 : 0
    this.legs[0].rotation.z = Math.sin(this.stride) * swing
    this.legs[1].rotation.z = -Math.sin(this.stride) * swing
    this.arms[0].rotation.z = -Math.sin(this.stride) * swing * 0.9
    this.arms[1].rotation.z = Math.sin(this.stride) * swing * 0.9
    body.position.set(0, isRunning ? Math.abs(Math.sin(this.stride)) * 0.07 : 0, 0)
    body.rotation.set(0, 0, isRunning ? -0.12 : 0)
    body.scale.setScalar(1)

    if (racer.state === 'exploding') {
      // Thrown up and tumbling, arms flung out, flashing red.
      const t = Math.min(1, this.explodeClock / 0.6)
      body.position.y = Math.sin(t * Math.PI) * 0.9
      body.rotation.x = Math.sin(t * Math.PI) * 0.5
      this.arms[0].rotation.z = this.arms[1].rotation.z = 2.4
      this.shirt.emissive.set(Math.floor(this.explodeClock * 12) % 2 === 0 ? 0xff3010 : 0x000000)
    } else if (racer.state === 'scanning') {
      // Standing still, holding the scanner out and pulsing.
      this.arms[0].rotation.z = this.arms[1].rotation.z = -1.35
      const pulse = 1 + 0.05 * Math.sin(this.scanClock * 22)
      body.scale.set(pulse, pulse, pulse)
      this.shirt.emissive.set(0x1a6a90).multiplyScalar(0.5 + 0.5 * Math.sin(this.scanClock * 16))
    } else if (racer.state === 'out') {
      const fall = Math.min(1, this.outClock / 0.45)
      body.rotation.x = fall * (Math.PI / 2) * 0.96
      body.position.y = (1 - fall) * 0.1 + fall * 0.22
      this.arms[0].rotation.z = this.arms[1].rotation.z = 0.5
      this.legs[0].rotation.z = this.legs[1].rotation.z = 0
      this.shirt.emissive.set(0x000000)
      if (!this.hasSoot) {
        this.hasSoot = true
        this.shirt.color.lerp(new Color(0x2e2a45), 0.65)
      }
    } else if (racer.state === 'won') {
      // A jump for joy on the spot, arms thrown up, with confetti.
      const t = (this.wonClock * 1.3) % 1
      body.position.y = Math.sin(t * Math.PI) * 0.75
      this.legs[0].rotation.z = this.legs[1].rotation.z = Math.sin(t * Math.PI) * 0.7
      this.arms[0].rotation.z = this.arms[1].rotation.z = 2.9
      this.shirt.emissive.set(0x000000)
      this.yaw += shortestAngle(this.yaw, Math.PI / 2) * damp(6, deltaSeconds)
    } else {
      this.shirt.emissive.set(0x000000)
    }

    // Protected after a blast: blinks, so nobody mistakes it for the safe-from-everything it is.
    body.visible = !(racer.isProtected && Math.floor(nowMs / 90) % 2 === 0 && racer.state !== 'exploding')

    for (const [index, piece] of this.confetti.entries()) {
      piece.visible = racer.state === 'won'
      if (!piece.visible) continue
      const t = (this.wonClock * 0.9 + index * 0.37) % 1
      const angle = index * 1.9
      piece.position.set(
        Math.cos(angle) * t * 1.8,
        2.2 - t * 2 + Math.sin(index) * 0.3,
        Math.sin(angle) * t * 1.8,
      )
      piece.rotation.set(t * 9 + index, t * 7, 0)
    }
  }

  dispose(): void {
    this.disposables.forEach((item) => { item.dispose() })
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item)
    return item
  }

  private add(
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
  ): Mesh {
    const mesh = new Mesh(this.track(geometry), material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
}
