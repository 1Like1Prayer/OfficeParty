import {
  CapsuleGeometry,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
  type Material,
  type Texture,
} from 'three'
import {
  RAMP_ANGLE_RADIANS,
  RUNNER_LOWEST_DISTANCE,
  RUNNER_START_DISTANCE,
  SLIP_RESPONSE_PER_SECOND,
  STEP_SPEED,
} from './arenaConfig.ts'
import type { EscalatorRamp } from './EscalatorRamp.ts'
import { LightBeam } from '../../three/LightBeam.ts'

type Phase = 'running' | 'sliding' | 'airborne' | 'swallowed' | 'carried'

const GRAVITY = 17
/** How hard the black hole pulls a falling runner sideways. */
const HOLE_PULL = 11
/** How long the final spiral into the centre takes. */
const SPIRAL_SECONDS = 0.85
/** Running pace in steps a second: full speed down to dragging their feet. */
const FASTEST_CADENCE = 3.4
const SLOWEST_CADENCE = 1.4
/** How hard a runner leans into the climb, and how far back they tip when slipping. */
const CLIMB_LEAN = -0.3
const SLIP_LEAN = 0.35

/** The beam that lifts a runner: how they hover, and the stages of being carried. */
const HOVER_HEIGHT = 5.5
const LIFT_SECONDS = 0.45
const CARRY_SECONDS = 0.9
const LOWER_SECONDS = 0.5
/** A runner arriving from nowhere is lowered from this high — out of sight above the screen. */
const DROP_FROM_HEIGHT = 34
const DROP_SECONDS = 1
/** The light fades in as a carry begins and out as it ends, over this long. */
const BEAM_FADE_IN_SECONDS = 0.25
const BEAM_FADE_OUT_SECONDS = 0.3

/** A runner's carry: when it starts, where from, and whether it begins in the sky. */
interface Carry {
  /** Counts up from minus the delay; the carry begins at zero. */
  clock: number
  /** Where the runner was when lifted, filled in as the carry begins. */
  from: Vector3 | null
  /** Arrives from above rather than being lifted off a ramp; hidden until then. */
  fromSky: boolean
}

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount

const CELEBRATE_SECONDS = 0.75
const CELEBRATE_HEIGHT = 0.9

/**
 * A low-poly runner built from jointed limbs: thighs and shins, upper arms and
 * forearms, a torso, and a head. Their avatar is the badge on their back,
 * since the camera sees them from behind as they climb.
 *
 * The figure owns its whole story: running in place against the escalator,
 * slowly losing ground as `slip` rises, then — once crushed — sliding off the
 * bottom, tumbling through the air and being pulled into the black hole.
 */
export class RunnerFigure {
  readonly root = new Group()
  private readonly torsoPivot = new Group()
  private readonly thighs: [Group, Group]
  private readonly shins: [Group, Group]
  private readonly shoulders: [Group, Group]
  private readonly forearms: [Group, Group]
  private readonly disposables: { dispose: () => void }[] = []

  private phase: Phase = 'running'
  private distanceUp = RUNNER_START_DISTANCE
  private strideAngle = Math.random() * Math.PI * 2
  private runAmount = 0
  private slip = 0
  private isRacing = false
  /** Seconds the victory jump has been going, or null while the runner is still racing. */
  private celebrationClock: number | null = null
  private slideSpeed = 0
  private velocity = new Vector3()
  private tumble = new Vector3()
  private spiralSeconds = 0
  private spiralFrom = new Vector3()
  private spiralAngle = 0
  private spiralRadius = 0

  private readonly ramp: EscalatorRamp
  private readonly holeCenter: Vector3
  private readonly onSwallowed: () => void
  private baseScale: number
  private carry: Carry | null = null
  private readonly beam: LightBeam

  constructor(
    ramp: EscalatorRamp,
    holeCenter: Vector3,
    onSwallowed: () => void,
    playerColor: string,
    badge: Texture,
    scale: number,
  ) {
    this.baseScale = scale
    this.root.scale.setScalar(scale)
    this.ramp = ramp
    this.holeCenter = holeCenter
    this.onSwallowed = onSwallowed
    const shirt = this.material(new MeshStandardMaterial({ color: playerColor, roughness: 0.6 }))
    const skin = this.material(new MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.7 }))
    const trousers = this.material(new MeshStandardMaterial({ color: 0x2e2a45, roughness: 0.8 }))

    this.root.add(this.torsoPivot)
    this.torsoPivot.position.y = 0.95

    this.addMesh(this.torsoPivot, new CapsuleGeometry(0.3, 0.5, 6, 14), shirt, [0, 0.5, 0])
    this.addMesh(this.torsoPivot, new SphereGeometry(0.27, 20, 16), skin, [0, 1.2, 0])
    const hair = this.addMesh(
      this.torsoPivot,
      new SphereGeometry(0.285, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      trousers,
      [0, 1.22, 0.02],
    )
    hair.rotation.x = 0.35

    // Avatar badge on the back, which faces the camera.
    const badgeMaterial = this.material(new MeshBasicMaterial({ map: badge }))
    const badgeMesh = new Mesh(this.track(new CircleGeometry(0.21, 28)), badgeMaterial)
    badgeMesh.position.set(0, 0.55, 0.305)
    this.torsoPivot.add(badgeMesh)

    this.thighs = [new Group(), new Group()]
    this.shins = [new Group(), new Group()]
    this.shoulders = [new Group(), new Group()]
    this.forearms = [new Group(), new Group()]

    ;([-1, 1] as const).forEach((side, index) => {
      this.buildLimb(this.root, this.thighs[index]!, this.shins[index]!, {
        pivot: [side * 0.15, 0.95, 0],
        upper: 0.5,
        lower: 0.5,
        radius: 0.1,
        upperMaterial: trousers,
        lowerMaterial: trousers,
      })
      this.buildLimb(this.torsoPivot, this.shoulders[index]!, this.forearms[index]!, {
        pivot: [side * 0.4, 0.85, 0],
        upper: 0.38,
        lower: 0.36,
        radius: 0.085,
        upperMaterial: shirt,
        lowerMaterial: skin,
      })
    })

    this.root.traverse((object) => { object.castShadow = true })

    // Added last so the light casts no shadow.
    this.beam = this.track(new LightBeam())
    this.root.add(this.beam.group)
    this.placeOnRamp()
  }

  /** Moves a runner into the escalator's ramp frame, upright at their spot. */
  update(deltaSeconds: number, isRacing: boolean): void {
    this.isRacing = isRacing
    if (this.carry !== null && this.updateCarry(deltaSeconds)) return
    switch (this.phase) {
      case 'running':
        this.updateRunning(deltaSeconds)
        break
      case 'sliding':
        this.updateSliding(deltaSeconds)
        break
      case 'airborne':
        this.updateAirborne(deltaSeconds)
        break
      case 'swallowed':
        this.updateSwallowed(deltaSeconds)
        break
      case 'carried':
        break
    }
  }

  /** How far behind the leader this runner is, 0 to 1. */
  setSlip(slip: number): void {
    this.slip = slip
  }

  /**
   * The runner has won: they stop climbing and hop for joy where they stand,
   * and the escalator can no longer take them. Only the first call counts.
   */
  celebrate(): void {
    if (this.phase !== 'running' || this.celebrationClock !== null) return
    this.celebrationClock = 0
  }

  /** The runner has been crushed; they start sliding off. Only the first call counts. */
  fall(): void {
    if (this.phase !== 'running') return
    this.phase = 'sliding'
    this.slideSpeed = STEP_SPEED
  }

  /** Scales the whole figure; the escalator grows and shrinks with the number of lanes. */
  setBaseScale(scale: number): void {
    this.baseScale = scale
    if (this.phase === 'running' || this.phase === 'carried') this.root.scale.setScalar(scale)
  }

  /**
   * Lifts the runner off the escalator on a beam, carries them to the start of
   * their lane (which may be moving to a new place meanwhile) and sets them
   * down there, `delaySeconds` from now. They keep running until the lift.
   */
  liftAndCarry(delaySeconds: number): void {
    this.carry = { clock: -delaySeconds, from: null, fromSky: false }
  }

  /**
   * Brings a runner in from nowhere: a newcomer to the screen, or one who was
   * swallowed earlier and is back for the next stage. Hidden until
   * `delaySeconds` from now, then lowered onto the start of their lane.
   */
  dropIn(delaySeconds: number): void {
    this.phase = 'running'
    this.slideSpeed = 0
    this.slip = 0
    this.root.visible = false
    this.carry = { clock: -delaySeconds, from: null, fromSky: true }
  }

  /** Still on the escalator, as opposed to sliding off it or already lost. */
  get isOnRamp(): boolean {
    return this.phase === 'running'
  }

  get isGone(): boolean {
    return this.phase === 'swallowed' && !this.root.visible
  }

  dispose(): void {
    this.disposables.forEach((item) => { item.dispose() })
  }

  /* ---------------- phases ---------------- */

  private updateRunning(deltaSeconds: number): void {
    if (this.celebrationClock !== null) {
      this.updateCelebrating(deltaSeconds)
      return
    }
    // Position: drift, slowly, toward where the gap puts them.
    const targetDistance = lerp(RUNNER_START_DISTANCE, RUNNER_LOWEST_DISTANCE, this.slip)
    this.distanceUp +=
      (targetDistance - this.distanceUp) * (1 - Math.exp(-SLIP_RESPONSE_PER_SECOND * deltaSeconds))

    this.runAmount += ((this.isRacing ? 1 : 0) - this.runAmount) * (1 - Math.exp(-6 * deltaSeconds))
    const cadence = lerp(FASTEST_CADENCE, SLOWEST_CADENCE, this.slip)
    this.strideAngle += cadence * Math.PI * 2 * deltaSeconds * (this.isRacing ? 1 : 0.15)

    this.placeOnRamp()
    this.poseRunning({
      stride: this.runAmount,
      // A tiring runner reaches less and sags more.
      reach: lerp(1, 0.6, this.slip),
      lean: lerp(CLIMB_LEAN, SLIP_LEAN, this.slip) * this.runAmount,
      flail: 0,
    })
  }

  /** A hop on the spot, arms thrown up, legs tucked at the top of each jump. */
  private updateCelebrating(deltaSeconds: number): void {
    this.celebrationClock = (this.celebrationClock ?? 0) + deltaSeconds
    // Settle where they are and stop slipping, whatever the gap says.
    this.slip += (0 - this.slip) * (1 - Math.exp(-6 * deltaSeconds))
    const targetDistance = lerp(RUNNER_START_DISTANCE, RUNNER_LOWEST_DISTANCE, this.slip)
    this.distanceUp += (targetDistance - this.distanceUp) * (1 - Math.exp(-SLIP_RESPONSE_PER_SECOND * deltaSeconds))
    this.runAmount += (0 - this.runAmount) * (1 - Math.exp(-10 * deltaSeconds))
    this.placeOnRamp()

    const cycle = (this.celebrationClock % CELEBRATE_SECONDS) / CELEBRATE_SECONDS
    const arc = Math.sin(cycle * Math.PI)
    this.root.position.y += arc * CELEBRATE_HEIGHT
    this.torsoPivot.position.y = 0.95 - (1 - arc) * 0.05
    this.torsoPivot.rotation.set(0, 0, 0)
    ;([0, 1] as const).forEach((leg) => {
      this.thighs[leg]!.rotation.x = -arc * 0.9
      this.shins[leg]!.rotation.x = arc * 1.3
      this.shoulders[leg]!.rotation.x = -Math.PI + 0.25 - arc * 0.15
      this.shoulders[leg]!.rotation.z = (leg === 0 ? 1 : -1) * 0.25
      this.forearms[leg]!.rotation.x = 0.2
    })
  }

  private updateSliding(deltaSeconds: number): void {
    // Losing the fight: the steps drag them down faster and faster.
    this.slideSpeed += 9 * deltaSeconds
    this.distanceUp -= this.slideSpeed * deltaSeconds
    this.strideAngle += 14 * deltaSeconds

    this.placeOnRamp()
    this.poseRunning({ stride: 1, reach: 1.3, lean: 0.55, flail: 1 })

    if (this.distanceUp <= 0) this.launch()
  }

  /** Off the lower edge: carried forward and down by the speed they slid at. */
  private launch(): void {
    this.phase = 'airborne'
    const downhill = new Vector3(0, -Math.sin(RAMP_ANGLE_RADIANS), Math.cos(RAMP_ANGLE_RADIANS))
    this.velocity.copy(downhill).multiplyScalar(this.slideSpeed)
    this.tumble.set(
      (Math.random() * 0.6 + 0.7) * 5,
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 6,
    )
  }

  private updateAirborne(deltaSeconds: number): void {
    const toHole = this.holeCenter.clone().sub(this.root.position)
    toHole.y = 0
    const pull = toHole.normalize().multiplyScalar(HOLE_PULL)
    this.velocity.x += pull.x * deltaSeconds
    this.velocity.z += pull.z * deltaSeconds
    this.velocity.y -= GRAVITY * deltaSeconds
    this.root.position.addScaledVector(this.velocity, deltaSeconds)
    this.root.rotation.x += this.tumble.x * deltaSeconds
    this.root.rotation.y += this.tumble.y * deltaSeconds
    this.root.rotation.z += this.tumble.z * deltaSeconds
    this.strideAngle += 18 * deltaSeconds
    this.poseRunning({ stride: 1, reach: 1.5, lean: 0, flail: 1 })

    if (this.root.position.y <= this.holeCenter.y + 0.4) this.beginSpiral()
  }

  private beginSpiral(): void {
    this.phase = 'swallowed'
    this.spiralSeconds = 0
    this.spiralFrom.copy(this.root.position)
    const offset = this.spiralFrom.clone().sub(this.holeCenter)
    this.spiralAngle = Math.atan2(offset.z, offset.x)
    this.spiralRadius = Math.hypot(offset.x, offset.z)
  }

  /** Dragged round and into the centre, shrinking as they go. */
  private updateSwallowed(deltaSeconds: number): void {
    if (!this.root.visible) return
    this.spiralSeconds += deltaSeconds
    const progress = Math.min(1, this.spiralSeconds / SPIRAL_SECONDS)
    const eased = progress * progress

    const angle = this.spiralAngle + eased * 5.5
    const radius = this.spiralRadius * (1 - eased)
    this.root.position.set(
      this.holeCenter.x + Math.cos(angle) * radius,
      lerp(this.spiralFrom.y, this.holeCenter.y - 0.6, eased),
      this.holeCenter.z + Math.sin(angle) * radius,
    )
    this.root.rotation.x += this.tumble.x * deltaSeconds * 1.4
    this.root.rotation.z += this.tumble.z * deltaSeconds * 1.4
    this.root.scale.setScalar(Math.max(0.001, 1 - eased) * this.baseScale)
    this.strideAngle += 20 * deltaSeconds
    this.poseRunning({ stride: 1, reach: 1.5, lean: 0, flail: 1 })

    if (progress >= 1) {
      this.root.visible = false
      this.onSwallowed()
    }
  }

  /* ---------------- carried ---------------- */

  /** Returns true while it is in charge of the figure; false to let the normal phase run. */
  private updateCarry(deltaSeconds: number): boolean {
    const carry = this.carry!
    carry.clock += deltaSeconds

    if (carry.clock < 0) return carry.fromSky // A runner still waiting to arrive stays hidden.

    const landing = this.ramp.pointAt(RUNNER_START_DISTANCE)
    if (this.phase !== 'carried') {
      this.phase = 'carried'
      this.root.visible = true
      this.root.rotation.set(0, 0, 0)
      this.root.scale.setScalar(this.baseScale)
      carry.from = carry.fromSky
        ? landing.clone().add(new Vector3(0, DROP_FROM_HEIGHT, 0))
        : this.root.position.clone()
    }
    const from = carry.from!
    const t = carry.clock

    if (carry.fromSky) {
      const drop = Math.min(1, t / DROP_SECONDS)
      this.root.position.lerpVectors(from, landing, drop * drop * (3 - 2 * drop))
      if (t >= DROP_SECONDS) this.endCarry()
    } else {
      const hover = (point: Vector3) => point.clone().add(new Vector3(0, HOVER_HEIGHT, 0))
      const smooth = (x: number) => x * x * (3 - 2 * x)
      if (t < LIFT_SECONDS) {
        this.root.position.lerpVectors(from, hover(from), smooth(t / LIFT_SECONDS))
      } else if (t < LIFT_SECONDS + CARRY_SECONDS) {
        const along = smooth((t - LIFT_SECONDS) / CARRY_SECONDS)
        this.root.position
          .lerpVectors(hover(from), hover(landing), along)
          // A gentle arc, so they are carried over rather than slid.
          .add(new Vector3(0, Math.sin(along * Math.PI) * 1.2, 0))
      } else {
        const down = Math.min(1, (t - LIFT_SECONDS - CARRY_SECONDS) / LOWER_SECONDS)
        this.root.position.lerpVectors(hover(landing), landing, smooth(down))
        if (down >= 1) this.endCarry()
      }
    }

    const total = carry.fromSky ? DROP_SECONDS : LIFT_SECONDS + CARRY_SECONDS + LOWER_SECONDS
    const strength = Math.min(t / BEAM_FADE_IN_SECONDS, (total - t) / BEAM_FADE_OUT_SECONDS)
    this.beam.update(deltaSeconds)
    this.beam.setStrength(Math.min(1, Math.max(0, strength)))

    // Dangling in the beam: a slow turn, legs swaying, arms loose.
    this.root.rotation.set(0, Math.sin(t * 3) * 0.3, 0)
    this.strideAngle += deltaSeconds * 3
    this.poseRunning({ stride: 0.18, reach: 0.5, lean: 0, flail: 0 })
    return true
  }

  private endCarry(): void {
    this.carry = null
    this.phase = 'running'
    this.distanceUp = RUNNER_START_DISTANCE
    this.slip = 0
    this.runAmount = 0
    this.beam.setStrength(0)
    this.root.rotation.set(0, 0, 0)
    this.root.scale.setScalar(this.baseScale)
    this.root.visible = true
  }

  /* ---------------- posing ---------------- */

  private placeOnRamp(): void {
    this.ramp.pointAt(this.distanceUp, 0, this.root.position)
    this.root.rotation.set(0, 0, 0)
    this.root.scale.setScalar(this.baseScale)
  }

  /**
   * One frame of the run cycle. `stride` fades the cycle in and out, `reach`
   * scales how far the limbs swing, `lean` tips the torso (negative =
   * forward), and `flail` adds the wild arms of someone falling.
   */
  private poseRunning({
    stride,
    reach,
    lean,
    flail,
  }: {
    stride: number
    reach: number
    lean: number
    flail: number
  }): void {
    const phase = this.strideAngle
    const bob = Math.abs(Math.sin(phase)) * 0.09 * stride * (1 - flail)
    this.torsoPivot.position.y = 0.95 + bob
    this.torsoPivot.rotation.x = lean + Math.sin(phase * 2) * 0.03 * stride
    this.torsoPivot.rotation.y = Math.sin(phase) * 0.12 * stride

    ;([0, 1] as const).forEach((leg) => {
      // The legs run half a cycle apart; each knee bends as its leg comes through.
      const legPhase = phase + leg * Math.PI
      const swing = Math.sin(legPhase)
      this.thighs[leg]!.rotation.x = swing * 0.95 * reach * stride
      this.shins[leg]!.rotation.x = -(0.15 + (1 - Math.cos(legPhase - 0.7)) * 0.7) * reach * stride

      // Arms counter-swing the legs, elbows bent like a sprinter's.
      const armSwing = Math.sin(legPhase + Math.PI)
      this.shoulders[leg]!.rotation.x = armSwing * 0.8 * reach * stride - flail * 2.2
      this.shoulders[leg]!.rotation.z = (leg === 0 ? 1 : -1) * flail * (0.7 + Math.sin(phase * 1.3) * 0.4)
      this.forearms[leg]!.rotation.x = (0.9 + armSwing * 0.3) * stride
    })
  }

  /* ---------------- construction helpers ---------------- */

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
    geometry: SphereGeometry | CapsuleGeometry,
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

  private material<T extends Material>(material: T): T {
    return this.track(material)
  }
}
