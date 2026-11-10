import {
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  Vector3,
  type Texture,
} from 'three'
import { STATION } from './stageConfig.ts'

const SECTORS = 10
const GRAVITY = 14

interface Piece {
  mesh: Mesh
  velocity: Vector3
  spin: Vector3
  hasSplashed: boolean
}

/**
 * The round block of wood a board rests on, standing in the water. It is made
 * of wedges that fit together into one solid log; when it gives way each wedge
 * breaks loose, tumbles outward and drops into the sea.
 *
 * Its top is the origin, and it reaches down `BLOCK_HEIGHT`.
 */
export class WoodBlock {
  readonly group = new Group()
  private readonly pieces: Piece[] = []
  private readonly material: MeshStandardMaterial
  private isCrumbling = false
  private waterY = 0
  private onSplash: ((position: Vector3) => void) | null = null

  constructor(wood: Texture) {
    this.material = new MeshStandardMaterial({ map: wood, roughness: 0.88, metalness: 0 })

    for (let sector = 0; sector < SECTORS; sector++) {
      const from = (sector / SECTORS) * Math.PI * 2
      const to = ((sector + 1) / SECTORS) * Math.PI * 2
      const wedge = new Shape()
      wedge.moveTo(0, 0)
      wedge.absarc(0, 0, STATION.BLOCK_RADIUS, from, to, false)
      wedge.lineTo(0, 0)

      const geometry = new ExtrudeGeometry(wedge, { depth: STATION.BLOCK_HEIGHT, bevelEnabled: false })
      // Extruded along +Z; stand it upright with its top at the origin.
      geometry.rotateX(-Math.PI / 2)
      geometry.translate(0, -STATION.BLOCK_HEIGHT, 0)

      const mesh = new Mesh(geometry, this.material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.group.add(mesh)
      this.pieces.push({ mesh, velocity: new Vector3(), spin: new Vector3(), hasSplashed: false })
    }
  }

  get hasCrumbled(): boolean {
    return this.isCrumbling
  }

  /**
   * Break apart. `waterY` is the sea's surface in this block's frame, and
   * `onSplash` is told where each wedge first hits it.
   */
  crumble(waterY: number, onSplash: (position: Vector3) => void): void {
    if (this.isCrumbling) return
    this.isCrumbling = true
    this.waterY = waterY
    this.onSplash = onSplash

    this.pieces.forEach((piece, index) => {
      const middle = ((index + 0.5) / SECTORS) * Math.PI * 2
      const outward = new Vector3(Math.cos(middle), 0, -Math.sin(middle))
      piece.velocity.copy(outward).multiplyScalar(1.4 + Math.random() * 2.6)
      piece.velocity.y = 1.5 + Math.random() * 3
      piece.spin.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 6,
      )
    })
  }

  update(deltaSeconds: number): void {
    if (!this.isCrumbling) return

    for (const piece of this.pieces) {
      if (!piece.mesh.visible) continue
      const { mesh, velocity, spin } = piece

      velocity.y -= GRAVITY * deltaSeconds
      mesh.position.addScaledVector(velocity, deltaSeconds)
      mesh.rotation.x += spin.x * deltaSeconds
      mesh.rotation.y += spin.y * deltaSeconds
      mesh.rotation.z += spin.z * deltaSeconds

      if (mesh.position.y < this.waterY) {
        if (!piece.hasSplashed) {
          piece.hasSplashed = true
          this.onSplash?.(mesh.position.clone().setY(this.waterY))
        }
        // In the water: the wood slows, floats a moment and sinks.
        const drag = Math.exp(-3.2 * deltaSeconds)
        velocity.multiplyScalar(drag)
        velocity.y = Math.max(velocity.y, -2.2)
        spin.multiplyScalar(drag)
      }
      if (mesh.position.y < this.waterY - STATION.BLOCK_HEIGHT - 3) mesh.visible = false
    }
  }

  dispose(): void {
    for (const { mesh } of this.pieces) mesh.geometry.dispose()
    this.material.dispose()
  }
}
