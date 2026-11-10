import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  type Material,
  Quaternion,
  Vector3,
  type Texture,
} from 'three'

const SIZE = 0.62
const ROLL_SECONDS = 1.55
/** Which die face number is on which side of the box, in BoxGeometry's order: +x, -x, +y, -y, +z, -z. */
export const FACE_ON_SIDE = [1, 6, 2, 5, 3, 4] as const
export const SIDE_NORMALS = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
]
const UP = new Vector3(0, 1, 0)

/** The turn that brings die face `face` round to point along `toward`. */
export function quaternionShowing(face: number, toward: Vector3, out = new Quaternion()): Quaternion {
  const side = FACE_ON_SIDE.indexOf(face as (typeof FACE_ON_SIDE)[number])
  return out.setFromUnitVectors(SIDE_NORMALS[Math.max(0, side)]!, toward)
}

/** Fills a die's six material slots: skulls on the lowest-numbered faces, hearts on the rest. */
export function assignFaces(
  slots: Material[],
  heart: Material,
  skull: Material,
  skulls: number,
): void {
  FACE_ON_SIDE.forEach((number, side) => {
    slots[side] = number <= skulls ? skull : heart
  })
}
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

interface Throw {
  face: number
  elapsed: number
  from: Vector3
  landing: Vector3
  axis: Vector3
  yaw: number
  hasLanded: boolean
  onLanded: () => void
}

/**
 * The roulette die: a cube of hearts and skulls. A throw tumbles it through
 * the air, bounces it twice on the board and leaves it showing exactly the
 * face the server rolled. The faces are lowest-numbered skulls first, so a die
 * with three skulls has skulls on 1, 2 and 3.
 */
export class Die {
  readonly mesh: Mesh
  private readonly materials: MeshStandardMaterial[]
  private current: Throw | null = null
  private resting = 0
  private readonly spinQuaternion = new Quaternion()
  private readonly finalQuaternion = new Quaternion()

  constructor(heart: Texture, skull: Texture) {
    const heartMaterial = new MeshStandardMaterial({ map: heart, roughness: 0.35 })
    const skullMaterial = new MeshStandardMaterial({ map: skull, roughness: 0.35 })
    this.materials = [heartMaterial, skullMaterial]
    // Six slots, filled per throw by how many sides are skulls.
    this.mesh = new Mesh(new BoxGeometry(SIZE, SIZE, SIZE), [
      heartMaterial,
      heartMaterial,
      heartMaterial,
      heartMaterial,
      heartMaterial,
      heartMaterial,
    ])
    this.mesh.castShadow = true
    this.mesh.visible = false
  }

  get isBusy(): boolean {
    return this.mesh.visible
  }

  /** How high its centre sits when it rests on a flat surface. */
  static readonly HALF_SIZE = SIZE / 2

  /**
   * Throw the die from `from` so it lands at `landing` showing `face`, with
   * `skulls` of its six sides skulls. `onLanded` fires as it comes to rest.
   */
  roll(face: number, skulls: number, from: Vector3, landing: Vector3, onLanded: () => void): void {
    assignFaces(this.mesh.material as MeshStandardMaterial[], this.materials[0]!, this.materials[1]!, skulls)

    this.current = {
      face,
      elapsed: 0,
      from: from.clone(),
      landing: landing.clone(),
      axis: new Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize(),
      yaw: Math.random() * Math.PI * 2,
      hasLanded: false,
      onLanded,
    }
    // The quaternion that turns the chosen face up, then a random turn about the vertical.
    quaternionShowing(face, UP, this.finalQuaternion)
      .premultiply(new Quaternion().setFromAxisAngle(UP, this.current.yaw))
    this.resting = 0
    this.mesh.visible = true
    this.mesh.scale.setScalar(1)
  }

  update(deltaSeconds: number): void {
    const toss = this.current
    if (toss === null) {
      this.fadeAfterRest(deltaSeconds)
      return
    }

    toss.elapsed += deltaSeconds
    const u = Math.min(1, toss.elapsed / ROLL_SECONDS)
    const resting = toss.landing
    const first = resting.clone()
    const second = resting.clone().add(new Vector3(0.32, 0, 0.1))
    const third = second.clone().add(new Vector3(0.1, 0, 0.04))

    // Flight, then two hops that shrink, then rest. Heights follow a parabola.
    if (u < 0.45) {
      const s = u / 0.45
      this.mesh.position.lerpVectors(toss.from, first, s)
      this.mesh.position.y += Math.sin(s * Math.PI) * 1.5
    } else if (u < 0.72) {
      const s = (u - 0.45) / 0.27
      this.mesh.position.lerpVectors(first, second, s)
      this.mesh.position.y += Math.sin(s * Math.PI) * 0.55
    } else if (u < 0.92) {
      const s = (u - 0.72) / 0.2
      this.mesh.position.lerpVectors(second, third, s)
      this.mesh.position.y += Math.sin(s * Math.PI) * 0.16
    } else {
      this.mesh.position.copy(third)
    }

    // It spins fast at first and slows, then eases onto the face it must show.
    const spinAngle = 11 * Math.PI * (1 - (1 - u) * (1 - u))
    this.spinQuaternion.setFromAxisAngle(toss.axis, spinAngle)
    this.mesh.quaternion.copy(this.spinQuaternion).slerp(this.finalQuaternion, smoothstep(0.4, 0.95, u))

    if (u >= 1 && !toss.hasLanded) {
      toss.hasLanded = true
      this.current = null
      this.resting = 0.0001
      toss.onLanded()
    }
  }

  /** Where it ended up, once thrown. */
  get restingPosition(): Vector3 {
    return this.mesh.position
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    for (const material of this.materials) material.dispose()
  }

  private fadeAfterRest(deltaSeconds: number): void {
    if (this.resting === 0) return
    this.resting += deltaSeconds
    // Stays to be read, then shrinks away.
    if (this.resting > 2.6) {
      const shrink = Math.max(0, 1 - (this.resting - 2.6) / 0.35)
      this.mesh.scale.setScalar(shrink)
      if (shrink === 0) {
        this.mesh.visible = false
        this.resting = 0
      }
    }
  }
}
