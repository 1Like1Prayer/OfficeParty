import { ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three'

const SPIKES = 6

/** A little golden crown that spins and bobs above the winner's head. */
export class Crown {
  /** Place this where the crown should hover; the spinning and bobbing happen inside it. */
  readonly group = new Group()
  private readonly inner = new Group()
  private readonly material = new MeshStandardMaterial({
    color: 0xffd24a,
    emissive: 0xc98a00,
    emissiveIntensity: 0.7,
    roughness: 0.25,
    metalness: 0.9,
    // The band is open, so it must show from both sides.
    side: DoubleSide,
  })
  private readonly geometries = [
    new CylinderGeometry(0.24, 0.21, 0.14, 24, 1, true),
    new ConeGeometry(0.06, 0.2, 10),
  ]
  private time = 0

  constructor() {
    const [band, spike] = this.geometries as [CylinderGeometry, ConeGeometry]
    this.group.add(this.inner)
    this.inner.add(new Mesh(band, this.material))

    for (let index = 0; index < SPIKES; index++) {
      const angle = (index / SPIKES) * Math.PI * 2
      const point = new Mesh(spike, this.material)
      point.position.set(Math.cos(angle) * 0.22, 0.16, Math.sin(angle) * 0.22)
      this.inner.add(point)
    }
    this.group.traverse((object) => { object.castShadow = true })
    this.group.visible = false
  }

  /** `appear` runs 0 to 1: the crown scales up as it arrives. */
  update(deltaSeconds: number, appear: number): void {
    this.time += deltaSeconds
    this.group.visible = appear > 0
    this.inner.rotation.y = this.time * 1.8
    this.inner.position.y = Math.sin(this.time * 2.4) * 0.05
    this.inner.scale.setScalar(Math.max(0.0001, appear))
  }

  dispose(): void {
    this.geometries.forEach((geometry) => { geometry.dispose() })
    this.material.dispose()
  }
}
