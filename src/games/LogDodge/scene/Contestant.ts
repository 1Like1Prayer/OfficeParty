import {
  AdditiveBlending,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three'
import type { Action } from '../../../shared/games/logDodge/types.ts'
import { BELT } from './sceneConfig.ts'

/* ---------------- proportions ---------------- */

/** Where the lower half meets the upper: the waist. */
const WAIST_Y = 0.88
const PELVIS_HEIGHT = 0.16
const LEG_PIVOT_Y = 0.78
const THIGH = 0.4
const SHIN = 0.4
const TORSO_HEIGHT = 0.62
const TORSO_RADIUS = 0.26
const HEAD_RADIUS = 0.24
const UPPER_ARM = 0.34
const FOREARM = 0.32

/* ---------------- the moves ---------------- */

/** How long a duck takes to come in and to let go. */
const ATTACK_SECONDS = 0.12
const RELEASE_SECONDS = 0.26
/** The fastest a jump can be; the scene stretches it to land the apex on the log. */
const JUMP_HEIGHT = 1.05

/** How far the hips sink in a duck, and how far the body leans. */
const DUCK_DROP = 0.33
const DUCK_LEAN = -0.75

/** Cadence in steps a second. */
const RUN_CADENCE = 3.2
/** How quickly the pose chases its target; high enough that a press reads at once. */
const POSE_RESPONSE_PER_SECOND = 30

/** The winner's victory jumps: how high, and how long each takes, ground to ground. */
const CELEBRATE_JUMP_HEIGHT = 1.25
const CELEBRATE_JUMP_SECONDS = 0.78

const ZAP_FLASH_SECONDS = 0.55
const ZAP_RING_SECONDS = 0.5
const KNOCKOUT_GRAVITY = 24

const ZAP_COLOR = new Color('#FF2A2A')

type Move = {
  action: Action
  elapsed: number
  /** Seconds the pose is held at full strength (duck) or airborne (jump). */
  hold: number
}

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount
const smooth = (x: number): number => x * x * (3 - 2 * x)
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

/** 0 to 1 as a move comes in, holds, and lets go. */
function envelope(elapsed: number, hold: number): number {
  if (elapsed < ATTACK_SECONDS) return smooth(elapsed / ATTACK_SECONDS)
  if (elapsed < ATTACK_SECONDS + hold) return 1
  return 1 - smooth(clamp01((elapsed - ATTACK_SECONDS - hold) / RELEASE_SECONDS))
}

/**
 * One contestant: a low-poly runner built from a lower half (pelvis and
 * legs) and an upper half (torso, head and arms), joined at the waist so the
 * hips can sink in a duck while the top leans forward.
 *
 * Their avatar is the badge on their back, since the camera sees them from
 * behind. The figure owns its own animation: it runs in place for as long as
 * it is on the belt, and `perform` plays a jump or a duck over the top.
 */
export class Contestant {
  /** Placed by the scene on the belt; everything else moves inside `rig`. */
  readonly root = new Group()
  private readonly rig = new Group()
  private readonly lower = new Group()
  private readonly upper = new Group()
  private readonly thighs: [Group, Group] = [new Group(), new Group()]
  private readonly shins: [Group, Group] = [new Group(), new Group()]
  private readonly shoulders: [Group, Group] = [new Group(), new Group()]
  private readonly forearms: [Group, Group] = [new Group(), new Group()]
  private readonly zapRing: Mesh
  private readonly lit: MeshStandardMaterial[] = []
  private readonly disposables: { dispose: () => void }[] = []

  private move: Move | null = null
  private strideAngle = Math.random() * Math.PI * 2
  private clock = Math.random() * 10

  // The pose, each chased toward its target so a press never pops.
  private crouch = 0
  private tuck = 0
  private armsUp = 0
  private jumpY = 0

  private flash = 0
  private shakeSeconds = 0
  private zapRingSeconds = ZAP_RING_SECONDS
  private isCelebrating = false
  /** When the victory jumps began, so the first one starts from the ground. */
  private celebrationStartedAt = 0

  private isKnockedOut = false
  private velocity = { x: 0, y: 0, z: 0 }
  private tumble = { x: 0, y: 0, z: 0 }
  private isGone = false

  constructor(playerColor: string, badge: Texture) {
    const shirt = this.litMaterial(new MeshStandardMaterial({ color: playerColor, roughness: 0.6 }))
    const skin = this.litMaterial(new MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.7 }))
    // Light enough to stand out against the dark belt.
    const trousers = this.litMaterial(new MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.8 }))
    const hairColor = this.litMaterial(new MeshStandardMaterial({ color: 0x2e2a45, roughness: 0.8 }))

    this.root.add(this.rig)
    this.rig.add(this.lower, this.upper)

    // The lower half: pelvis and legs. Its origin is the floor.
    this.addMesh(
      this.lower,
      new CylinderGeometry(0.24, 0.22, PELVIS_HEIGHT, 16),
      trousers,
      [0, WAIST_Y - PELVIS_HEIGHT / 2, 0],
    )

    // The upper half. Its origin is the waist.
    this.addMesh(
      this.upper,
      new CylinderGeometry(TORSO_RADIUS, 0.23, TORSO_HEIGHT, 18),
      shirt,
      [0, TORSO_HEIGHT / 2, 0],
    )
    this.addMesh(
      this.upper,
      new SphereGeometry(TORSO_RADIUS, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      shirt,
      [0, TORSO_HEIGHT, 0],
    )
    this.addMesh(this.upper, new SphereGeometry(HEAD_RADIUS, 20, 16), skin, [
      0,
      TORSO_HEIGHT + HEAD_RADIUS * 0.85,
      0,
    ])
    const hair = this.addMesh(
      this.upper,
      new SphereGeometry(HEAD_RADIUS * 1.06, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairColor,
      [0, TORSO_HEIGHT + HEAD_RADIUS * 0.9, 0.02],
    )
    hair.rotation.x = 0.35

    // The badge on the back, which faces the camera.
    const badgeMesh = new Mesh(
      this.track(new CircleGeometry(0.2, 28)),
      this.track(new MeshBasicMaterial({ map: badge })),
    )
    badgeMesh.position.set(0, 0.34, TORSO_RADIUS + 0.005)
    this.upper.add(badgeMesh)

    ;([-1, 1] as const).forEach((side, index) => {
      this.buildLimb(this.lower, this.thighs[index]!, this.shins[index]!, {
        pivot: [side * 0.13, LEG_PIVOT_Y, 0],
        upper: THIGH,
        lower: SHIN,
        radius: 0.095,
        upperMaterial: trousers,
        lowerMaterial: trousers,
      })
      this.buildLimb(this.upper, this.shoulders[index]!, this.forearms[index]!, {
        pivot: [side * (TORSO_RADIUS + 0.1), TORSO_HEIGHT - 0.06, 0],
        upper: UPPER_ARM,
        lower: FOREARM,
        radius: 0.08,
        upperMaterial: shirt,
        lowerMaterial: skin,
      })
    })

    this.zapRing = new Mesh(
      this.track(new RingGeometry(0.45, 0.6, 40)),
      this.track(
        new MeshBasicMaterial({
          color: 0xff3030,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
        }),
      ),
    )
    this.zapRing.rotation.x = -Math.PI / 2
    this.zapRing.position.y = 0.06
    this.zapRing.visible = false
    this.root.add(this.zapRing)

    this.rig.traverse((object) => { object.castShadow = true })
    this.zapRing.castShadow = false
  }

  /* ---------------- what the scene can ask of it ---------------- */

  /**
   * Plays a move now. `holdSeconds` is how long a duck stays at full
   * strength, or how long a jump stays in the air — the scene sets it so the
   * move is still in force when the log it answers arrives.
   */
  perform(action: Action, holdSeconds: number): void {
    if (this.isKnockedOut) return
    this.move = { action, elapsed: 0, hold: holdSeconds }
  }

  /** Hit by a log: a red flash, a rattle and a ring of sparks. */
  zap(): void {
    if (this.isKnockedOut) return
    this.flash = 1
    this.shakeSeconds = ZAP_FLASH_SECONDS
    this.zapRingSeconds = 0
  }

  /** Out of the round: thrown back, and carried off the end of the belt. */
  knockOut(): void {
    if (this.isKnockedOut) return
    this.zap()
    this.isKnockedOut = true
    this.move = null
    this.isCelebrating = false
    this.velocity = { x: (Math.random() - 0.5) * 5, y: 7.5, z: 4 }
    this.tumble = {
      x: (Math.random() * 0.6 + 0.7) * 5,
      y: (Math.random() - 0.5) * 4,
      z: (Math.random() - 0.5) * 6,
    }
  }

  /** Still standing when it ends: jumps for joy on the spot, until told otherwise. */
  celebrate(): void {
    if (this.isKnockedOut || this.isCelebrating) return
    this.isCelebrating = true
    this.celebrationStartedAt = this.clock
  }

  get isOut(): boolean {
    return this.isKnockedOut
  }

  /** Thrown clear of the belt and out of sight. */
  get hasLeft(): boolean {
    return this.isGone
  }

  /** Whether a move is in progress, so the scene need not stack another on it. */
  get isMoving(): boolean {
    return this.move !== null
  }

  dispose(): void {
    this.disposables.forEach((item) => { item.dispose() })
  }

  /* ---------------- per frame ---------------- */

  update(deltaSeconds: number): void {
    if (this.isGone) return
    this.clock += deltaSeconds
    this.updateFlash(deltaSeconds)

    if (this.isKnockedOut) {
      this.updateKnockedOut(deltaSeconds)
      return
    }

    const targets = this.advanceMove(deltaSeconds)
    const chase = 1 - Math.exp(-POSE_RESPONSE_PER_SECOND * deltaSeconds)
    this.crouch += (targets.crouch - this.crouch) * chase
    this.tuck += (targets.tuck - this.tuck) * chase
    this.armsUp += (targets.armsUp - this.armsUp) * chase
    this.jumpY = targets.jumpY

    this.strideAngle += RUN_CADENCE * Math.PI * 2 * deltaSeconds
    this.pose()
  }

  /* ---------------- moves ---------------- */

  private advanceMove(deltaSeconds: number): {
    crouch: number
    tuck: number
    armsUp: number
    jumpY: number
  } {
    const still = { crouch: 0, tuck: 0, armsUp: 0, jumpY: 0 }

    if (this.isCelebrating) {
      // Jumping for joy, on the spot: a deep dip to load the jump, a high arc with the
      // knees tucked and both arms thrown up, then down into the next dip.
      const phase = ((this.clock - this.celebrationStartedAt) % CELEBRATE_JUMP_SECONDS) / CELEBRATE_JUMP_SECONDS
      const arc = 4 * phase * (1 - phase)
      const dip = Math.pow(1 - arc, 6)
      return {
        ...still,
        crouch: dip * 0.45,
        tuck: smooth(clamp01(arc * 2.4)),
        armsUp: 1,
        jumpY: arc * CELEBRATE_JUMP_HEIGHT,
      }
    }

    const move = this.move
    if (move === null) return still
    move.elapsed += deltaSeconds

    switch (move.action) {
      case 'jump': {
        // A parabola, so the apex lands halfway through the air time.
        const progress = move.elapsed / move.hold
        if (progress >= 1) {
          this.move = null
          return still
        }
        const arc = 4 * progress * (1 - progress)
        return { ...still, jumpY: arc * JUMP_HEIGHT, tuck: smooth(clamp01(arc * 2.2)), armsUp: 0.8 }
      }
      case 'duck': {
        const amount = envelope(move.elapsed, move.hold)
        if (move.elapsed >= ATTACK_SECONDS + move.hold + RELEASE_SECONDS) this.move = null
        return { ...still, crouch: amount }
      }
    }
  }

  /* ---------------- posing ---------------- */

  private pose(): void {
    const { crouch, tuck } = this
    const phase = this.strideAngle

    // The hips sink in a duck, the legs staying put under them.
    const drop = crouch * DUCK_DROP
    this.lower.position.y = -drop
    this.rig.position.y = this.jumpY

    // The top half leans into a duck and tips back as the knees come up in a jump.
    this.upper.position.y = WAIST_Y - drop
    this.upper.rotation.x = crouch * DUCK_LEAN + tuck * -0.2
    this.upper.rotation.y = Math.sin(phase) * 0.1

    ;([0, 1] as const).forEach((leg) => {
      const legPhase = phase + leg * Math.PI
      const swing = Math.sin(legPhase)
      const runThigh = swing * 0.95
      const runShin = -(0.15 + (1 - Math.cos(legPhase - 0.7)) * 0.7)
      // A duck sinks into a squat, still running.
      const squat = crouch
      const squatThigh = 1.15 + swing * 0.3
      const squatShin = -1.7 + swing * 0.15
      const tuckThigh = 1.25 + swing * 0.12
      const tuckShin = -1.95

      const thigh = lerp(lerp(runThigh, squatThigh, squat), tuckThigh, tuck)
      const shin = lerp(lerp(runShin, squatShin, squat), tuckShin, tuck)
      this.thighs[leg]!.rotation.x = thigh
      this.shins[leg]!.rotation.x = shin

      // Arms swing against the legs; thrown up for a jump.
      const armSwing = Math.sin(legPhase + Math.PI)
      const runArm = armSwing * 0.8
      this.shoulders[leg]!.rotation.x = lerp(runArm, 2.5, this.armsUp)
      this.shoulders[leg]!.rotation.z = (leg === 0 ? 1 : -1) * this.armsUp * 0.35
      this.forearms[leg]!.rotation.x = lerp(0.9 + armSwing * 0.3, 0.2, this.armsUp)
    })

    // Bobbing along as they run, unless they are airborne or in pieces.
    const grounded = 1 - Math.max(tuck, crouch * 0.5)
    this.rig.position.y += Math.abs(Math.sin(phase)) * 0.06 * grounded
  }

  /* ---------------- reactions ---------------- */

  private updateFlash(deltaSeconds: number): void {
    this.flash = Math.max(0, this.flash - deltaSeconds / ZAP_FLASH_SECONDS)
    for (const material of this.lit) {
      material.emissive.copy(ZAP_COLOR).multiplyScalar(this.flash)
    }

    // A rattle that dies down, applied on top of whatever else the figure is doing.
    this.shakeSeconds = Math.max(0, this.shakeSeconds - deltaSeconds)
    const rattle = this.isKnockedOut ? 0 : (this.shakeSeconds / ZAP_FLASH_SECONDS) * 0.09
    if (!this.isKnockedOut) this.rig.position.x = (Math.random() - 0.5) * 2 * rattle

    // The ring of sparks expands from the feet.
    this.zapRingSeconds = Math.min(ZAP_RING_SECONDS, this.zapRingSeconds + deltaSeconds)
    const ringProgress = this.zapRingSeconds / ZAP_RING_SECONDS
    this.zapRing.visible = ringProgress < 1
    this.zapRing.scale.setScalar(1 + ringProgress * 3.2)
    ;(this.zapRing.material as MeshBasicMaterial).opacity = (1 - ringProgress) * 0.9
  }

  private updateKnockedOut(deltaSeconds: number): void {
    this.velocity.y -= KNOCKOUT_GRAVITY * deltaSeconds
    const worldZ = this.root.position.z + this.rig.position.z
    const isOnBelt = worldZ < BELT.NEAR_Z - 0.3

    this.rig.position.x += this.velocity.x * deltaSeconds
    this.rig.position.y += this.velocity.y * deltaSeconds
    this.rig.position.z += this.velocity.z * deltaSeconds
    this.rig.rotation.x += this.tumble.x * deltaSeconds
    this.rig.rotation.y += this.tumble.y * deltaSeconds
    this.rig.rotation.z += this.tumble.z * deltaSeconds

    if (isOnBelt && this.rig.position.y < 0 && this.velocity.y < 0) {
      // Lands on the belt, bounces a little, and is carried along with it.
      this.rig.position.y = 0
      this.velocity.y = -this.velocity.y * 0.35
      this.velocity.x *= 0.6
      this.velocity.z = BELT.SPEED
      this.tumble.x *= 0.6
      this.tumble.y *= 0.6
      this.tumble.z *= 0.6
    }
    if (this.rig.position.y < -14) {
      this.isGone = true
      this.root.visible = false
    }
  }

  /* ---------------- construction ---------------- */

  private buildLimb(
    parent: Group,
    upperPivot: Group,
    lowerPivot: Group,
    {
      pivot,
      upper,
      lower,
      radius,
      upperMaterial,
      lowerMaterial,
    }: {
      pivot: [number, number, number]
      upper: number
      lower: number
      radius: number
      upperMaterial: Material
      lowerMaterial: Material
    },
  ): void {
    upperPivot.position.set(...pivot)
    parent.add(upperPivot)
    this.addMesh(upperPivot, new CapsuleGeometry(radius, upper - radius, 4, 10), upperMaterial, [
      0,
      -upper / 2,
      0,
    ])
    lowerPivot.position.set(0, -upper, 0)
    upperPivot.add(lowerPivot)
    this.addMesh(lowerPivot, new CapsuleGeometry(radius * 0.9, lower - radius, 4, 10), lowerMaterial, [
      0,
      -lower / 2,
      0,
    ])
  }

  private addMesh(
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    [x, y, z]: [number, number, number],
  ): Mesh {
    const mesh = new Mesh(this.track(geometry), material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item)
    return item
  }

  private litMaterial(material: MeshStandardMaterial): MeshStandardMaterial {
    this.lit.push(material)
    return this.track(material)
  }
}
