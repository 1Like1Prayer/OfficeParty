import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three'
import {
  RAMP_ANGLE_RADIANS,
  RAMP_LENGTH,
  STEP_PITCH,
  STEP_SPEED,
} from './arenaConfig.ts'

const TREAD_THICKNESS = 0.14
const TREAD_DEPTH = STEP_PITCH * 0.8
const RISER_HEIGHT = 0.3
const RISER_DEPTH = 0.07
/** Where support pylons stand along the ramp, clear of the black hole. */
const PYLON_DISTANCES = [11, 17, 23, 29]
const PYLON_HEIGHT = 40
/** How fast the escalator spins up and powers down, per second. */
const POWER_RESPONSE = 2.2

/** One part of every step: its shape, and where it sits relative to the step's centre. */
interface StepPart {
  mesh: InstancedMesh
  offset: Vector3
}

/**
 * One escalator: a 30° ramp of real stepped treads — tread, riser and a
 * yellow safety edge — riding down a deep steel chassis on tall pylons that
 * vanish into the dark. Glass panels, handrails and a strip of light in the
 * player's colour run down both sides.
 *
 * Built in its own frame — the ramp's surface is y = 0 and "up the ramp" is
 * -Z — and the group is then tilted, so the geometry stays simple.
 */
export class EscalatorRamp {
  readonly group = new Group()
  private readonly stepParts: StepPart[]
  private readonly stripMaterial: MeshStandardMaterial
  private readonly underglowMaterial: MeshStandardMaterial
  private readonly stepCount = Math.ceil(RAMP_LENGTH / STEP_PITCH)
  private readonly placeholder = new Object3D()
  private stepOffset = 0
  private power = 0
  private targetPower = 0

  private readonly laneWidth: number

  constructor(centerX: number, playerColor: string, laneWidth: number) {
    this.laneWidth = laneWidth
    this.group.position.set(centerX, 0, 0)
    this.group.rotation.x = RAMP_ANGLE_RADIANS
    const laneColor = new Color(playerColor)

    const steel = new MeshStandardMaterial({ color: 0x2a2540, roughness: 0.5, metalness: 0.6 })
    const darkSteel = new MeshStandardMaterial({ color: 0x15121f, roughness: 0.6, metalness: 0.5 })

    // A deep chassis, so the ramp reads as a solid machine rather than a plank.
    this.addBox(steel, [this.laneWidth + 1.1, 1.3, RAMP_LENGTH], [0, -0.85, -RAMP_LENGTH / 2])
    for (let beam = 1; beam < RAMP_LENGTH; beam += 3) {
      this.addBox(darkSteel, [this.laneWidth + 1.5, 0.3, 0.3], [0, -1.6, -beam])
    }
    this.underglowMaterial = new MeshStandardMaterial({
      color: 0x000000,
      emissive: laneColor,
      emissiveIntensity: 0,
    })
    this.addBox(this.underglowMaterial, [this.laneWidth + 0.6, 0.1, RAMP_LENGTH], [0, -1.55, -RAMP_LENGTH / 2])

    this.stepParts = [
      this.createStepPart(
        new BoxGeometry(this.laneWidth, TREAD_THICKNESS, TREAD_DEPTH),
        new MeshStandardMaterial({ color: 0xd2cbe8, roughness: 0.35, metalness: 0.4 }),
        [0, 0, 0],
      ),
      this.createStepPart(
        new BoxGeometry(this.laneWidth, RISER_HEIGHT, RISER_DEPTH),
        new MeshStandardMaterial({ color: 0x4a4468, roughness: 0.5, metalness: 0.5 }),
        [0, -(TREAD_THICKNESS + RISER_HEIGHT) / 2, TREAD_DEPTH / 2 - RISER_DEPTH / 2],
      ),
      // The yellow demarcation line along each tread's upper edge.
      this.createStepPart(
        new BoxGeometry(this.laneWidth, 0.02, 0.07),
        new MeshStandardMaterial({
          color: 0xffc400,
          emissive: new Color(0xffa800),
          emissiveIntensity: 0.5,
        }),
        [0, TREAD_THICKNESS / 2 + 0.005, -TREAD_DEPTH / 2 + 0.05],
      ),
    ]
    this.placeSteps()

    this.stripMaterial = new MeshStandardMaterial({
      color: 0x111111,
      emissive: laneColor,
      emissiveIntensity: 0,
      roughness: 0.3,
    })
    const railMaterial = new MeshStandardMaterial({ color: 0x15121f, roughness: 0.35, metalness: 0.2 })
    const glassMaterial = new MeshStandardMaterial({
      color: 0x9fb8ff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.1,
    })
    for (const side of [-1, 1]) {
      const edgeX = side * (this.laneWidth / 2 + 0.22)
      this.addBox(this.stripMaterial, [0.14, 0.1, RAMP_LENGTH], [edgeX, 0.05, -RAMP_LENGTH / 2])
      this.addBox(railMaterial, [0.22, 0.22, RAMP_LENGTH], [edgeX, 1.3, -RAMP_LENGTH / 2])
      this.addBox(steel, [0.12, 1.1, RAMP_LENGTH], [edgeX + side * 0.1, 0.55, -RAMP_LENGTH / 2])
      this.addBox(glassMaterial, [0.05, 0.9, RAMP_LENGTH], [edgeX, 0.75, -RAMP_LENGTH / 2]).castShadow = false
    }

    this.addPylons(steel)
    this.group.updateMatrixWorld(true)
  }

  /** Where the lane's centre line is, and how wide it is drawn, relative to its built width. */
  setLayout(centerX: number, laneScale: number): void {
    this.group.position.x = centerX
    this.group.scale.x = laneScale
    this.group.updateMatrixWorld(true)
  }

  /** Raises or sinks the whole escalator, for rising in from, or dropping into, the dark. */
  setHeightOffset(height: number): void {
    this.group.position.y = height
    this.group.updateMatrixWorld(true)
  }

  get centerX(): number {
    return this.group.position.x
  }

  get laneScale(): number {
    return this.group.scale.x
  }

  /**
   * Where a spot on a ramp centred at `centerX` will be, without needing the
   * ramp to exist yet — for framing a layout the scene is still moving toward.
   */
  static pointOn(centerX: number, distance: number, lift = 0, target = new Vector3()): Vector3 {
    const height = TREAD_THICKNESS / 2 + lift
    return target.set(
      centerX,
      height * Math.cos(RAMP_ANGLE_RADIANS) + distance * Math.sin(RAMP_ANGLE_RADIANS),
      height * Math.sin(RAMP_ANGLE_RADIANS) - distance * Math.cos(RAMP_ANGLE_RADIANS),
    )
  }

  /** The world position of the spot `distance` up the ramp, `lift` above its surface. */
  pointAt(distance: number, lift = 0, target = new Vector3()): Vector3 {
    return this.group.localToWorld(target.set(0, TREAD_THICKNESS / 2 + lift, -distance))
  }

  /** An unpowered escalator stops and its lights go out. */
  setPowered(isPowered: boolean): void {
    this.targetPower = isPowered ? 1 : 0
  }

  update(deltaSeconds: number): void {
    this.power += (this.targetPower - this.power) * (1 - Math.exp(-POWER_RESPONSE * deltaSeconds))
    this.stepOffset = (this.stepOffset + STEP_SPEED * this.power * deltaSeconds) % STEP_PITCH
    this.placeSteps()
    this.stripMaterial.emissiveIntensity = 0.15 + this.power * 1.8
    this.underglowMaterial.emissiveIntensity = 0.1 + this.power * 1.4
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof Mesh || object instanceof InstancedMesh) {
        object.geometry.dispose()
        ;[object.material].flat().forEach((material) => { material.dispose() })
      }
    })
  }

  private createStepPart(
    geometry: BoxGeometry,
    material: MeshStandardMaterial,
    offset: [number, number, number],
  ): StepPart {
    const mesh = new InstancedMesh(geometry, material, this.stepCount)
    mesh.receiveShadow = true
    mesh.castShadow = true
    mesh.frustumCulled = false
    this.group.add(mesh)
    return { mesh, offset: new Vector3(...offset) }
  }

  private addBox(
    material: MeshStandardMaterial,
    [width, height, depth]: [number, number, number],
    [x, y, z]: [number, number, number],
  ): Mesh {
    const box = new Mesh(new BoxGeometry(width, height, depth), material)
    box.position.set(x, y, z)
    box.castShadow = true
    box.receiveShadow = true
    this.group.add(box)
    return box
  }

  /** Tall legs plunging into the dark. Counter-rotated so they stand truly upright. */
  private addPylons(material: MeshStandardMaterial): void {
    for (const distance of PYLON_DISTANCES) {
      const stand = new Group()
      stand.position.set(0, -1.6, -distance)
      stand.rotation.x = -RAMP_ANGLE_RADIANS
      for (const side of [-1, 1]) {
        const leg = new Mesh(new BoxGeometry(0.35, PYLON_HEIGHT, 0.35), material)
        leg.position.set(side * (this.laneWidth / 2 + 0.3), -PYLON_HEIGHT / 2, 0)
        leg.castShadow = true
        stand.add(leg)
      }
      this.group.add(stand)
    }
  }

  /** Steps travel toward the lower end (+Z) and wrap round to the top. */
  private placeSteps(): void {
    for (let index = 0; index < this.stepCount; index++) {
      const distanceFromTop = (index * STEP_PITCH + this.stepOffset) % (this.stepCount * STEP_PITCH)
      for (const { mesh, offset } of this.stepParts) {
        this.placeholder.position.set(offset.x, offset.y, -RAMP_LENGTH + distanceFromTop + offset.z)
        this.placeholder.updateMatrix()
        mesh.setMatrixAt(index, this.placeholder.matrix)
      }
    }
    for (const { mesh } of this.stepParts) mesh.instanceMatrix.needsUpdate = true
  }
}
