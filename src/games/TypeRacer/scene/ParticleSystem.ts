import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'

const MAX_PARTICLES = 1800

const VERTEX = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aShape;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vShape;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vShape = aShape;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -viewPosition.z);
    gl_Position = projectionMatrix * viewPosition;
  }
`

/** Round dots, or hearts for the ones that mean it. */
const FRAGMENT = `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vShape;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float shape;
    if (vShape > 0.5) {
      p.y = -p.y * 1.05 + 0.25;
      float a = p.x * p.x + p.y * p.y - 0.55;
      shape = 1.0 - smoothstep(0.0, 0.08, a * a * a - p.x * p.x * p.y * p.y * p.y);
    } else {
      shape = 1.0 - smoothstep(0.55, 1.0, length(p));
    }
    gl_FragColor = vec4(vColor, vAlpha * shape);
  }
`

export interface Burst {
  position: Vector3
  count: number
  color: number | readonly number[]
  /** Outward speed, in units a second. */
  speed: number
  /** Extra upward speed on top. */
  up?: number
  gravity?: number
  /** Positive floats up (bubbles, hearts); the particle also slows as it goes. */
  buoyancy?: number
  life: number
  size: number
  shape?: 'dot' | 'heart'
}

/**
 * Splashes, wood chips, bubbles and floating hearts: one pool of particles
 * drawn in a single call. Each burst says how fast, how heavy and how long.
 */
export class ParticleSystem {
  readonly points: Points
  private readonly geometry = new BufferGeometry()
  private readonly material: ShaderMaterial
  private readonly position = new Float32Array(MAX_PARTICLES * 3)
  private readonly velocity = new Float32Array(MAX_PARTICLES * 3)
  private readonly color = new Float32Array(MAX_PARTICLES * 3)
  private readonly size = new Float32Array(MAX_PARTICLES)
  private readonly alpha = new Float32Array(MAX_PARTICLES)
  private readonly shape = new Float32Array(MAX_PARTICLES)
  private readonly age = new Float32Array(MAX_PARTICLES)
  private readonly life = new Float32Array(MAX_PARTICLES)
  private readonly gravity = new Float32Array(MAX_PARTICLES)
  private readonly buoyancy = new Float32Array(MAX_PARTICLES)
  private readonly baseSize = new Float32Array(MAX_PARTICLES)
  private next = 0
  private readonly tint = new Color()

  /** `additive` particles are added together, so they glow; the rest are opaque specks. */
  constructor(additive = false) {
    this.geometry.setAttribute('position', new BufferAttribute(this.position, 3))
    this.geometry.setAttribute('aColor', new BufferAttribute(this.color, 3))
    this.geometry.setAttribute('aSize', new BufferAttribute(this.size, 1))
    this.geometry.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1))
    this.geometry.setAttribute('aShape', new BufferAttribute(this.shape, 1))
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    })
    this.points = new Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 5
    // Everything starts dead.
    this.life.fill(0)
    this.age.fill(1)
  }

  emit(burst: Burst): void {
    const colors = Array.isArray(burst.color) ? burst.color : [burst.color as number]
    for (let index = 0; index < burst.count; index++) {
      const slot = this.next
      this.next = (this.next + 1) % MAX_PARTICLES
      const direction = new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
      const speed = burst.speed * (0.4 + Math.random() * 0.8)

      this.position.set([burst.position.x, burst.position.y, burst.position.z], slot * 3)
      this.velocity.set(
        [direction.x * speed, (burst.up ?? 0) * (0.5 + Math.random()) , direction.z * speed],
        slot * 3,
      )
      this.tint.set(colors[Math.floor(Math.random() * colors.length)]!)
      this.color.set([this.tint.r, this.tint.g, this.tint.b], slot * 3)
      this.baseSize[slot] = burst.size * (0.6 + Math.random() * 0.8)
      this.shape[slot] = burst.shape === 'heart' ? 1 : 0
      this.life[slot] = burst.life * (0.7 + Math.random() * 0.6)
      this.age[slot] = 0
      this.gravity[slot] = burst.gravity ?? 9
      this.buoyancy[slot] = burst.buoyancy ?? 0
    }
  }

  update(deltaSeconds: number): void {
    for (let slot = 0; slot < MAX_PARTICLES; slot++) {
      if (this.age[slot]! >= this.life[slot]!) {
        this.alpha[slot] = 0
        continue
      }
      this.age[slot]! += deltaSeconds
      const t = this.age[slot]! / this.life[slot]!
      const buoyant = this.buoyancy[slot]!

      if (buoyant !== 0) {
        // Floats up, gently drifting, and slows as it rises.
        this.velocity[slot * 3 + 1]! += buoyant * deltaSeconds
        this.velocity[slot * 3]! *= 1 - 1.5 * deltaSeconds
        this.velocity[slot * 3 + 2]! *= 1 - 1.5 * deltaSeconds
      } else {
        this.velocity[slot * 3 + 1]! -= this.gravity[slot]! * deltaSeconds
      }
      for (let axis = 0; axis < 3; axis++) {
        this.position[slot * 3 + axis]! += this.velocity[slot * 3 + axis]! * deltaSeconds
      }
      // Fades out over the last of its life, and swells a little as it goes.
      this.alpha[slot] = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
      this.size[slot] = this.baseSize[slot]! * (0.85 + 0.3 * t)
    }
    this.geometry.attributes.position!.needsUpdate = true
    this.geometry.attributes.aAlpha!.needsUpdate = true
    this.geometry.attributes.aSize!.needsUpdate = true
    this.geometry.attributes.aColor!.needsUpdate = true
    this.geometry.attributes.aShape!.needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
