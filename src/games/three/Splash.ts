import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  type Scene,
} from 'three'

const DURATION_SECONDS = 0.9
const DROPLET_COUNT = 10
const GRAVITY = 22

interface Droplet {
  mesh: Mesh
  vx: number
  vy: number
  vz: number
}

interface ActiveSplash {
  group: Group
  ring: Mesh
  ringMaterial: MeshBasicMaterial
  dropletMaterial: MeshBasicMaterial
  droplets: Droplet[]
  elapsed: number
}

/**
 * Splashes on a sea: a white ring that spreads and fades on the water, and a
 * spray of droplets thrown up that fall back in. Each one cleans itself up.
 */
export class Splashes {
  private readonly ringGeometry = new RingGeometry(0.7, 1, 40)
  private readonly dropletGeometry = new SphereGeometry(0.14, 8, 6)
  private active: ActiveSplash[] = []

  private readonly scene: Scene

  constructor(scene: Scene) {
    this.scene = scene
    // Flat on the water.
    this.ringGeometry.rotateX(-Math.PI / 2)
  }

  /** Starts a splash at a point on the surface. */
  add(x: number, y: number, z: number): void {
    const group = new Group()
    group.position.set(x, y, z)

    const ringMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: DoubleSide })
    const ring = new Mesh(this.ringGeometry, ringMaterial)
    ring.renderOrder = 1
    group.add(ring)

    const dropletMaterial = new MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, depthWrite: false })
    const droplets: Droplet[] = []
    for (let index = 0; index < DROPLET_COUNT; index++) {
      const angle = (index / DROPLET_COUNT) * Math.PI * 2 + Math.random() * 0.5
      const outward = 1.5 + Math.random() * 2
      const mesh = new Mesh(this.dropletGeometry, dropletMaterial)
      mesh.scale.setScalar(0.7 + Math.random() * 0.8)
      group.add(mesh)
      droplets.push({ mesh, vx: Math.cos(angle) * outward, vy: 6 + Math.random() * 4, vz: Math.sin(angle) * outward })
    }

    this.scene.add(group)
    this.active.push({ group, ring, ringMaterial, dropletMaterial, droplets, elapsed: 0 })
  }

  update(deltaSeconds: number): void {
    this.active = this.active.filter((splash) => {
      splash.elapsed += deltaSeconds
      const progress = Math.min(splash.elapsed / DURATION_SECONDS, 1)
      if (progress >= 1) {
        this.remove(splash)
        return false
      }

      // The ring races out, then slows as it fades.
      const spread = 1 - (1 - progress) ** 3
      splash.ring.scale.setScalar(0.4 + spread * 2.6)
      splash.ringMaterial.opacity = 0.85 * (1 - progress)

      for (const droplet of splash.droplets) {
        droplet.vy -= GRAVITY * deltaSeconds
        droplet.mesh.position.x += droplet.vx * deltaSeconds
        droplet.mesh.position.y += droplet.vy * deltaSeconds
        droplet.mesh.position.z += droplet.vz * deltaSeconds
        // Back under the water, it is gone.
        droplet.mesh.visible = droplet.mesh.position.y > -0.1
      }
      splash.dropletMaterial.opacity = 1 - progress * progress
      return true
    })
  }

  dispose(): void {
    for (const splash of this.active) this.remove(splash)
    this.active = []
    this.ringGeometry.dispose()
    this.dropletGeometry.dispose()
  }

  private remove(splash: ActiveSplash): void {
    this.scene.remove(splash.group)
    splash.ringMaterial.dispose()
    splash.dropletMaterial.dispose()
  }
}
