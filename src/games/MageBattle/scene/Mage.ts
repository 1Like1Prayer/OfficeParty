import {
  AdditiveBlending,
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three'

/** What a mage is doing this frame. */
export type MagePose = 'idle' | 'casting' | 'out' | 'won'

const INK = new Color('#2E2A45')
const CONFETTI_COLORS = [0xff5fa2, 0xffd24a, 0x5ad1a0, 0x5aa9ff]
const CONFETTI_COUNT = 14
/** A hit thrusts the wand forward for this long; a miss knocks the mage back for this long. */
const THRUST_SECONDS = 0.35
const RECOIL_SECONDS = 0.5
/** Motes of power spiralling into the wand's tip while it charges. */
const CHARGE_SPARK_COUNT = 8

const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt)

/**
 * A little low-poly mage: a robe in their colour, a pointed hat, and a wand
 * held out in front. Built facing +x, so turning the root to face the middle
 * of the circle points the wand there. Their avatar is a badge on the back of
 * the robe, which is the side the camera sees over their shoulder.
 */
export class Mage {
  readonly root = new Group()
  private readonly body = new Group()
  private readonly wandArm = new Group()
  private readonly otherArm = new Group()
  private readonly hat = new Group()
  private readonly tip: Mesh
  private readonly robe: MeshStandardMaterial
  private readonly tipMaterial: MeshBasicMaterial
  private readonly confetti: Mesh[] = []
  private readonly chargeOrb: Mesh
  private readonly chargeHalo: Mesh
  private readonly chargeSparks: Mesh[] = []
  /** 0 at rest, rising to 1 as the spell gathers at the wand's tip, before it is fired. */
  private charge = 0
  private readonly disposables: { dispose: () => void }[] = []

  private thrust = 0
  private recoil = 0
  private outClock = 0
  private wonClock = 0
  private sway = Math.random() * 10

  constructor(color: string, badge: Texture) {
    const robeColor = new Color(color)
    this.robe = this.track(new MeshStandardMaterial({ color: robeColor, roughness: 0.75 }))
    const trim = this.track(new MeshStandardMaterial({ color: robeColor.clone().lerp(INK, 0.55), roughness: 0.8 }))
    const skin = this.track(new MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.7 }))
    const wood = this.track(new MeshStandardMaterial({ color: 0x6b4426, roughness: 0.6 }))
    this.tipMaterial = this.track(new MeshBasicMaterial({ color: robeColor.clone().lerp(new Color(0xffffff), 0.5) }))

    this.root.add(this.body)
    this.root.scale.setScalar(1.25)

    // Robe, a belt, and a head.
    this.add(this.body, new ConeGeometry(0.5, 1.35, 14, 1, true), this.robe, 0, 0.68, 0)
    this.add(this.body, new CylinderGeometry(0.5, 0.5, 0.04, 14), trim, 0, 0.02, 0)
    this.add(this.body, new CylinderGeometry(0.235, 0.27, 0.07, 14), trim, 0, 0.98, 0)
    this.add(this.body, new SphereGeometry(0.21, 16, 12), skin, 0.02, 1.42, 0)

    // The hat: a brim and a tall cone, leaning back a little.
    this.hat.position.set(0, 1.56, 0)
    this.add(this.hat, new CylinderGeometry(0.42, 0.42, 0.035, 18), trim, 0, 0, 0)
    const crown = this.add(this.hat, new ConeGeometry(0.27, 0.72, 16), trim, -0.04, 0.36, 0)
    crown.rotation.z = 0.18
    this.body.add(this.hat)

    // The wand arm reaches forward (+x); the wand carries on from the hand, its tip glowing.
    this.wandArm.position.set(0.05, 1.12, 0.24)
    const arm = this.add(this.wandArm, new CapsuleGeometry(0.075, 0.34, 4, 8), this.robe, 0.22, 0, 0)
    arm.rotation.z = -Math.PI / 2
    const wand = this.add(this.wandArm, new CylinderGeometry(0.022, 0.03, 0.55, 8), wood, 0.68, 0.02, 0)
    wand.rotation.z = -Math.PI / 2
    this.tip = this.add(this.wandArm, new SphereGeometry(0.06, 12, 10), this.tipMaterial, 0.97, 0.02, 0)
    this.body.add(this.wandArm)

    // The spell gathering at the tip: a white-hot ball in a halo of their colour, and motes spiralling in.
    const glow = (hex: Color, opacity: number) =>
      this.track(new MeshBasicMaterial({ color: hex, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false }))
    const tipColor = robeColor.clone().lerp(new Color(0xffffff), 0.35)
    this.chargeOrb = this.add(this.wandArm, new SphereGeometry(1, 16, 12), glow(new Color(0xffffff), 0.95), 0.97, 0.02, 0)
    this.chargeHalo = this.add(this.wandArm, new SphereGeometry(1, 16, 12), glow(tipColor, 0.45), 0.97, 0.02, 0)
    const mote = this.track(new SphereGeometry(0.035, 6, 4))
    const moteMaterial = glow(tipColor, 1)
    for (let index = 0; index < CHARGE_SPARK_COUNT; index++) {
      const spark = new Mesh(mote, moteMaterial)
      this.wandArm.add(spark)
      this.chargeSparks.push(spark)
    }

    this.otherArm.position.set(0, 1.1, -0.26)
    this.add(this.otherArm, new CapsuleGeometry(0.075, 0.32, 4, 8), this.robe, 0, -0.2, 0)
    this.otherArm.rotation.x = 0.25
    this.body.add(this.otherArm)

    // The avatar badge, on the back (-x).
    const badgeMesh = new Mesh(
      this.track(new CircleGeometry(0.2, 24)),
      this.track(new MeshBasicMaterial({ map: badge, transparent: true })),
    )
    badgeMesh.position.set(-0.33, 0.78, 0)
    badgeMesh.rotation.set(0, -Math.PI / 2, 0.28)
    this.body.add(badgeMesh)

    this.root.traverse((object) => { object.castShadow = true })
    for (const glowing of [this.chargeOrb, this.chargeHalo, ...this.chargeSparks]) glowing.castShadow = false

    const piece = this.track(new BoxGeometry(0.12, 0.035, 0.12))
    for (let index = 0; index < CONFETTI_COUNT; index++) {
      const mesh = new Mesh(piece, this.track(new MeshBasicMaterial({ color: CONFETTI_COLORS[index % CONFETTI_COLORS.length]! })))
      mesh.visible = false
      this.confetti.push(mesh)
      this.root.add(mesh)
    }
  }

  /** Where the wand's tip is in the world, which is where the beam leaves from. */
  tipPosition(target: Vector3): Vector3 {
    return this.tip.getWorldPosition(target)
  }

  /** How far the opening spell has gathered at the wand's tip, 0..1; back to 0 once it is fired. */
  setCharge(charge: number): void {
    this.charge = Math.min(1, Math.max(0, charge))
  }

  /** The spell landed: a thrust of the wand. */
  thrustWand(): void {
    this.thrust = THRUST_SECONDS
  }

  /** The spell fizzled: knocked back a step. */
  stagger(): void {
    this.recoil = RECOIL_SECONDS
  }

  update(pose: MagePose, deltaSeconds: number): void {
    const { body } = this
    this.sway += deltaSeconds
    this.thrust = Math.max(0, this.thrust - deltaSeconds)
    this.recoil = Math.max(0, this.recoil - deltaSeconds)
    this.outClock = pose === 'out' ? this.outClock + deltaSeconds : 0
    this.wonClock = pose === 'won' ? this.wonClock + deltaSeconds : 0

    // Braced against the push from the middle: a slow sway, leaning in.
    const thrust = Math.sin((this.thrust / THRUST_SECONDS) * Math.PI)
    const recoil = Math.sin((this.recoil / RECOIL_SECONDS) * Math.PI)
    const lean = pose === 'casting' ? 0.12 + thrust * 0.12 - recoil * 0.3 : 0
    body.rotation.set(Math.sin(this.sway * 1.3) * 0.03, 0, -lean)
    body.position.set(thrust * 0.12 - recoil * 0.25, 0, 0)
    this.wandArm.rotation.set(0, 0, pose === 'casting' ? 0.12 + thrust * 0.1 - recoil * 0.4 : -0.9)
    this.wandArm.position.x = 0.05 + thrust * 0.1
    this.otherArm.rotation.z = pose === 'casting' ? -0.5 - recoil * 0.6 : 0
    this.hat.rotation.z = recoil * 0.3
    this.tipMaterial.color.setScalar(1)
    this.tipMaterial.color.lerp(this.robe.color, recoil > 0 ? 0.9 : 0.4)

    this.updateCharge(pose)

    if (pose === 'out') {
      // Blown off their feet, backwards, and left lying there.
      const fall = Math.min(1, this.outClock / 0.55)
      body.rotation.z = fall * (Math.PI / 2) * 0.95
      body.position.x = -fall * 0.6
      body.position.y = Math.sin(fall * Math.PI) * 0.35 + fall * 0.22
      this.wandArm.rotation.z = 0.6
      this.hat.position.set(-fall * 0.25, 1.56 + Math.sin(fall * Math.PI) * 0.6, 0)
    } else {
      this.hat.position.set(0, 1.56, 0)
    }

    if (pose === 'won') {
      // Up on their toes, wand raised, bobbing.
      const t = (this.wonClock * 1.4) % 1
      body.position.y = Math.sin(t * Math.PI) * 0.45
      this.wandArm.rotation.z = 1.9
      this.otherArm.rotation.z = -2.4
    }

    for (const [index, piece] of this.confetti.entries()) {
      piece.visible = pose === 'won'
      if (!piece.visible) continue
      const t = (this.wonClock * 0.9 + index * 0.37) % 1
      const angle = index * 1.9
      piece.position.set(Math.cos(angle) * t * 1.6, 2.6 - t * 2.3, Math.sin(angle) * t * 1.6)
      piece.rotation.set(t * 9 + index, t * 7, 0)
    }

    // Eases rather than snaps when the pose changes.
    body.rotation.y += (0 - body.rotation.y) * damp(10, deltaSeconds)
  }

  /** Wand raised high and drawn back, the other hand up, while a ball of power swells at the tip. */
  private updateCharge(pose: MagePose): void {
    const charge = pose === 'out' || pose === 'won' ? 0 : this.charge
    const isCharging = charge > 0.001
    this.chargeOrb.visible = this.chargeHalo.visible = isCharging
    for (const spark of this.chargeSparks) spark.visible = isCharging
    if (!isCharging) return

    const lift = Math.sin(Math.min(1, charge * 1.6) * (Math.PI / 2))
    this.wandArm.rotation.z += (1.25 - this.wandArm.rotation.z) * lift
    this.otherArm.rotation.z += (-1.6 - this.otherArm.rotation.z) * lift
    this.body.rotation.z += 0.16 * lift
    this.body.position.x -= 0.08 * lift
    // Shaking with the strain as it nears full.
    const strain = charge * charge
    this.body.position.y = Math.sin(this.sway * 47) * 0.015 * strain

    const flicker = 1 + 0.18 * Math.sin(this.sway * 31) * strain
    this.chargeOrb.scale.setScalar((0.05 + charge * 0.16) * flicker)
    this.chargeHalo.scale.setScalar((0.1 + charge * 0.42) * flicker)
    this.chargeSparks.forEach((spark, index) => {
      // Each mote spirals in to the tip and starts again further out.
      const t = (this.sway * (1.4 + charge * 1.6) + index / CHARGE_SPARK_COUNT) % 1
      const radius = 0.15 + (1 - t) * 0.75
      const angle = index * 2.4 + t * 7
      spark.position.set(0.97 + Math.cos(angle) * radius * 0.6, 0.02 + Math.sin(angle) * radius, Math.cos(angle * 1.3) * radius * 0.6)
      spark.scale.setScalar(0.6 + t * 1.2)
    })
    this.tipMaterial.color.set(0xffffff)
  }

  dispose(): void {
    this.disposables.forEach((item) => { item.dispose() })
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item)
    return item
  }

  private add(parent: Group, geometry: BufferGeometry, material: Material, x: number, y: number, z: number): Mesh {
    const mesh = new Mesh(this.track(geometry), material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
}
