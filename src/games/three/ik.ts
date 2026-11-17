import { Quaternion, Vector3, type Object3D } from 'three'

const DOWN = new Vector3(0, -1, 0)
const scratch = new Vector3()
const direction = new Vector3()

/**
 * Where the middle joint of a two-bone limb sits so its far end reaches
 * `target`, bending toward `pole`. A target out of reach is pulled in.
 */
export function solveTwoBone(
  root: Vector3,
  target: Vector3,
  upperLength: number,
  lowerLength: number,
  pole: Vector3,
  out = new Vector3(),
): Vector3 {
  direction.subVectors(target, root)
  const reach = Math.min(
    Math.max(direction.length(), Math.abs(upperLength - lowerLength) + 0.01),
    upperLength + lowerLength - 0.01,
  )
  direction.normalize()

  const along = (upperLength * upperLength - lowerLength * lowerLength + reach * reach) / (2 * reach)
  const out_ = Math.sqrt(Math.max(0, upperLength * upperLength - along * along))

  // The part of the pole direction at right angles to the limb.
  scratch.copy(pole).addScaledVector(direction, -pole.dot(direction)).normalize()
  return out.copy(root).addScaledVector(direction, along).addScaledVector(scratch, out_)
}

/** Points a limb that hangs along its own -Y from `from` toward `to`. */
export function aimLimb(limb: Object3D, from: Vector3, to: Vector3): void {
  limb.position.copy(from)
  scratch.subVectors(to, from).normalize()
  limb.quaternion.copy(new Quaternion().setFromUnitVectors(DOWN, scratch))
}
