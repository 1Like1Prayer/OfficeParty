import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  type Scene,
} from 'three'

const SHOCKWAVE_SECONDS = 0.55
const SHOCKWAVE_POOL = 8
const BOLT_COUNT = 7
const BOLT_POINTS = 9
/** A new set of lightning forks this often. */
const BOLT_REFRESH_SECONDS = 0.07
const SPARK_COUNT = 160
const SPARK_LIFE_SECONDS = 0.9
const SPARK_GRAVITY = 9

interface Shockwave {
  mesh: Mesh
  material: MeshBasicMaterial
  age: number
  size: number
}

interface Spark {
  position: Vector3
  velocity: Vector3
  age: number
}

const WHITE = new Color(0xffffff)

function radialTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  return new CanvasTexture(canvas)
}

/**
 * Where the beams meet: a white-hot orb in a halo tinted by the beams pouring
 * into it, lightning crackling off it, two rings of power spinning round it, a
 * fountain of sparks and a glow on the ground below. A landed spell throws out
 * a shockwave and a burst of sparks.
 */
export class Clash {
  private readonly group = new Group()
  private readonly disposables: { dispose: () => void }[] = []
  private readonly light = new PointLight(0xe8dcff, 0, 24, 1.6)
  private readonly core: Mesh
  private readonly halo: Sprite
  private readonly haloMaterial: SpriteMaterial
  private readonly rings: Mesh[] = []
  private readonly ringMaterial: MeshBasicMaterial
  private readonly bolts: Line[] = []
  private readonly boltMaterial: LineBasicMaterial
  private readonly ground: Mesh
  private readonly groundMaterial: MeshBasicMaterial
  private readonly shockwaves: Shockwave[] = []
  private readonly sparks: Spark[] = []
  private readonly sparkGeometry = new BufferGeometry()
  private readonly sparkMaterial: PointsMaterial
  private readonly tint = new Color(0x9f86ff)
  private boltClock = 0
  private sparkDebt = 0
  private seconds = 0
  private readonly at: Vector3
  private readonly sparkPoints: Points

  constructor(scene: Scene, at: Vector3) {
    this.at = at.clone()
    const glow = this.track(radialTexture())
    const additive = { transparent: true, blending: AdditiveBlending, depthWrite: false } as const

    this.core = new Mesh(this.track(new SphereGeometry(0.32, 24, 16)), this.track(new MeshBasicMaterial({ color: 0xffffff, ...additive })))
    // A soft glow facing the camera, rather than a sphere that would read as a bubble.
    this.haloMaterial = this.track(new SpriteMaterial({ color: this.tint, map: glow, opacity: 0.9, ...additive }))
    this.halo = new Sprite(this.haloMaterial)

    this.ringMaterial = this.track(new MeshBasicMaterial({ color: 0xffffff, opacity: 0.7, side: DoubleSide, ...additive }))
    const ringGeometry = this.track(new TorusGeometry(1.15, 0.035, 8, 64))
    for (let index = 0; index < 2; index++) {
      const ring = new Mesh(ringGeometry, this.ringMaterial)
      this.rings.push(ring)
      this.group.add(ring)
    }

    this.boltMaterial = this.track(new LineBasicMaterial({ color: 0xffffff, opacity: 0.9, ...additive }))
    for (let index = 0; index < BOLT_COUNT; index++) {
      const geometry = this.track(new BufferGeometry())
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(BOLT_POINTS * 3), 3))
      const bolt = new Line(geometry, this.boltMaterial)
      bolt.frustumCulled = false
      this.bolts.push(bolt)
      this.group.add(bolt)
    }

    this.groundMaterial = this.track(new MeshBasicMaterial({ color: this.tint, map: glow, opacity: 0.6, ...additive }))
    this.ground = new Mesh(this.track(new CircleGeometry(3, 48)), this.groundMaterial)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.position.set(at.x, 0.05, at.z)

    const waveGeometry = this.track(new RingGeometry(0.9, 1, 64))
    for (let index = 0; index < SHOCKWAVE_POOL; index++) {
      const material = this.track(new MeshBasicMaterial({ color: 0xffffff, opacity: 0, side: DoubleSide, ...additive }))
      const mesh = new Mesh(waveGeometry, material)
      mesh.visible = false
      this.shockwaves.push({ mesh, material, age: SHOCKWAVE_SECONDS, size: 1 })
      this.group.add(mesh)
    }

    for (let index = 0; index < SPARK_COUNT; index++) {
      this.sparks.push({ position: new Vector3(), velocity: new Vector3(), age: SPARK_LIFE_SECONDS })
    }
    this.sparkGeometry.setAttribute('position', new BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3))
    this.sparkGeometry.setAttribute('color', new BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3))
    this.track(this.sparkGeometry)
    this.sparkMaterial = this.track(new PointsMaterial({ size: 0.16, map: glow, vertexColors: true, ...additive }))
    this.sparkPoints = new Points(this.sparkGeometry, this.sparkMaterial)
    this.sparkPoints.frustumCulled = false

    this.group.add(this.halo, this.core)
    this.group.position.copy(at)
    this.light.position.copy(at)
    // Sparks and the ground glow live in world space, not round the orb.
    scene.add(this.group, this.ground, this.sparkPoints, this.light)
  }

  /** A spell landed: a shockwave in the caster's colour and a burst of sparks, bigger for more points. */
  burst(color: string, points: number): void {
    const wave = this.shockwaves.find(({ age }) => age >= SHOCKWAVE_SECONDS) ?? this.shockwaves[0]!
    wave.age = 0
    wave.size = 1.2 + points * 0.55
    wave.material.color.set(color)
    this.spawnSparks(18 + points * 10, new Color(color), 1 + points * 0.25)
  }

  /**
   * `power` is how much is pouring in (the beams' strengths, summed); `colors`
   * the colours of the beams feeding it.
   */
  update(power: number, colors: readonly Color[], deltaSeconds: number, cameraPosition: Vector3): void {
    this.seconds += deltaSeconds
    const t = this.seconds
    const visible = power > 0.01
    const swell = Math.min(1.8, 0.45 + power * 0.28)
    const flicker = 1 + 0.1 * Math.sin(t * 23) + 0.06 * Math.sin(t * 37)

    // The halo takes on the beams' colours, shifting between them.
    if (colors.length > 0) {
      const phase = (t * 0.6) % colors.length
      const from = colors[Math.floor(phase)]!
      const to = colors[(Math.floor(phase) + 1) % colors.length]!
      this.tint.copy(from).lerp(to, phase % 1).lerp(WHITE, 0.15)
    }
    this.haloMaterial.color.copy(this.tint)
    this.groundMaterial.color.copy(this.tint)

    this.core.visible = this.halo.visible = visible
    this.core.scale.setScalar(swell * flicker)
    this.halo.scale.setScalar(swell * (3.2 + 0.5 * Math.sin(t * 5)))
    this.haloMaterial.opacity = 0.75 + 0.2 * Math.sin(t * 9)
    this.light.color.copy(this.tint).lerp(WHITE, 0.4)
    this.light.intensity = visible ? 7 * swell * flicker : 0

    // Two rings, tumbling on different axes.
    this.rings.forEach((ring, index) => {
      ring.visible = visible
      ring.scale.setScalar(swell * (1 + 0.06 * Math.sin(t * 6 + index)))
      ring.rotation.set(t * (1.3 + index * 0.6) + index * 1.2, t * (0.9 - index * 1.7), index * 0.8)
    })
    this.ringMaterial.opacity = 0.45 + 0.25 * Math.sin(t * 11)

    this.ground.visible = visible
    this.ground.scale.setScalar(swell * (0.9 + 0.1 * Math.sin(t * 4)))
    this.groundMaterial.opacity = Math.min(0.75, 0.25 + power * 0.12)

    this.updateBolts(visible, swell, deltaSeconds)
    this.updateShockwaves(deltaSeconds, cameraPosition)

    // A steady fountain while the beams pour in, more with more of them.
    if (visible) {
      this.sparkDebt += deltaSeconds * (20 + power * 18)
      const count = Math.floor(this.sparkDebt)
      this.sparkDebt -= count
      if (count > 0) this.spawnSparks(count, this.tint, 0.7)
    }
    this.updateSparks(deltaSeconds)
  }

  dispose(): void {
    this.group.removeFromParent()
    this.ground.removeFromParent()
    this.light.removeFromParent()
    this.sparkPoints.removeFromParent()
    this.disposables.forEach((item) => { item.dispose() })
  }

  /** Jagged forks of lightning out of the orb, redrawn a dozen times a second. */
  private updateBolts(visible: boolean, swell: number, deltaSeconds: number): void {
    this.boltClock -= deltaSeconds
    const redraw = this.boltClock <= 0
    if (redraw) this.boltClock = BOLT_REFRESH_SECONDS
    for (const bolt of this.bolts) {
      // Some forks are dark at any moment, so it crackles rather than glows.
      if (redraw) bolt.visible = visible && Math.random() < 0.7
      if (!bolt.visible || !redraw) continue
      const positions = bolt.geometry.getAttribute('position') as BufferAttribute
      const direction = new Vector3(Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5).normalize()
      const length = (0.9 + Math.random() * 1.4) * swell
      for (let index = 0; index < BOLT_POINTS; index++) {
        const along = index / (BOLT_POINTS - 1)
        const jag = index === 0 ? 0 : 0.28 * swell
        positions.setXYZ(
          index,
          direction.x * along * length + (Math.random() - 0.5) * jag,
          direction.y * along * length + (Math.random() - 0.5) * jag,
          direction.z * along * length + (Math.random() - 0.5) * jag,
        )
      }
      positions.needsUpdate = true
    }
    this.boltMaterial.color.copy(WHITE).lerp(this.tint, 0.35)
  }

  private updateShockwaves(deltaSeconds: number, cameraPosition: Vector3): void {
    for (const wave of this.shockwaves) {
      wave.age += deltaSeconds
      const t = wave.age / SHOCKWAVE_SECONDS
      wave.mesh.visible = t < 1
      if (!wave.mesh.visible) continue
      wave.mesh.scale.setScalar(0.5 + (1 - (1 - t) ** 2) * wave.size)
      wave.material.opacity = (1 - t) * 0.95
      wave.mesh.lookAt(cameraPosition)
    }
  }

  private spawnSparks(count: number, color: Color, speed: number): void {
    const colors = this.sparkGeometry.getAttribute('color') as BufferAttribute
    let spawned = 0
    for (const [index, spark] of this.sparks.entries()) {
      if (spawned >= count) break
      if (spark.age < SPARK_LIFE_SECONDS) continue
      spark.age = Math.random() * 0.2
      spark.position.copy(this.at)
      spark.velocity.set(Math.random() - 0.5, Math.random() * 0.8 + 0.1, Math.random() - 0.5).normalize()
        .multiplyScalar((3 + Math.random() * 4) * speed)
      const shade = color.clone().lerp(WHITE, Math.random() * 0.6)
      colors.setXYZ(index, shade.r, shade.g, shade.b)
      spawned++
    }
    colors.needsUpdate = true
  }

  private updateSparks(deltaSeconds: number): void {
    const positions = this.sparkGeometry.getAttribute('position') as BufferAttribute
    for (const [index, spark] of this.sparks.entries()) {
      spark.age += deltaSeconds
      if (spark.age >= SPARK_LIFE_SECONDS || spark.position.y < 0) {
        spark.age = SPARK_LIFE_SECONDS
        // Parked out of sight until it is used again.
        positions.setXYZ(index, 0, -100, 0)
        continue
      }
      spark.velocity.y -= SPARK_GRAVITY * deltaSeconds
      spark.velocity.multiplyScalar(1 - 1.2 * deltaSeconds)
      spark.position.addScaledVector(spark.velocity, deltaSeconds)
      positions.setXYZ(index, spark.position.x, spark.position.y, spark.position.z)
    }
    positions.needsUpdate = true
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item)
    return item
  }
}
