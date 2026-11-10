import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Group,
  MathUtils,
  Mesh,
  Points,
  PointLight,
  PointsMaterial,
  ShaderMaterial,
  Vector3,
} from 'three'
import { HOLE_DEPTH } from './arenaConfig.ts'

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * The maw: ragged, churning gas in dying reds winding into a white-hot rim,
 * barbed streamers clawing outward, and a centre so black it looks like a
 * hole in the picture. `uLayer` darkens and quickens the lower layers, which
 * are stacked beneath to give the pit some depth.
 */
const FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uPulse;
  uniform float uHunger;
  uniform float uLayer;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave++) {
      value += amplitude * noise(p);
      p = mat2(1.6, 1.2, -1.2, 1.6) * p;
      amplitude *= 0.5;
    }
    return value;
  }
  mat2 rotation(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;
    float angle = atan(p.y, p.x);
    float speed = 1.0 + uLayer * 0.8;

    // Inner gas orbits faster than outer gas, so the churn is dragged into a spiral.
    vec2 swirled = rotation(uTime * 0.55 * speed / (r + 0.25)) * p;
    float turbulence = fbm(swirled * 4.0 + uLayer * 7.0);
    float winding = angle * 2.0 + log(max(r, 0.001)) * 7.0 - uTime * 1.1 * speed + turbulence * 3.0;
    float arms = pow(smoothstep(-0.35, 1.0, sin(winding)), 1.6);

    float horizon = 0.27;
    float outerFade = smoothstep(1.0, 0.32, r);
    float energy = 0.7 + uHunger * 0.7 + uPulse * 1.5;

    vec3 ember = vec3(0.42, 0.015, 0.05);
    vec3 fire = vec3(1.0, 0.30, 0.04);
    vec3 bruise = vec3(0.30, 0.0, 0.55);
    vec3 gas = mix(bruise, ember, smoothstep(1.0, 0.65, r));
    gas = mix(gas, fire, smoothstep(0.6, 0.28, r));
    gas *= (arms * 0.85 + turbulence * 0.6) * outerFade * energy * 1.7;

    // Barbed streamers, flickering as they reach out of the rim.
    float barbs = pow(abs(sin(angle * 11.0 + turbulence * 4.0 - uTime * 1.4)), 14.0);
    barbs *= smoothstep(horizon + 0.02, horizon + 0.06, r) * smoothstep(0.62, 0.3, r);
    vec3 streamers = vec3(1.0, 0.18, 0.08) * barbs * (1.2 + uPulse * 3.0 + uHunger);

    float flicker = 0.85 + 0.15 * sin(uTime * 23.0 + angle * 5.0) * sin(uTime * 7.0);
    float ring = smoothstep(0.045, 0.0, abs(r - horizon - 0.03));
    float halo = smoothstep(0.2, 0.0, abs(r - horizon - 0.03)) * 0.45;
    vec3 rim = vec3(1.0, 0.82, 0.78) * ring * (1.6 + uPulse * 3.0) * flicker
             + vec3(1.0, 0.12, 0.05) * halo * (1.0 + uPulse * 2.0);

    float inside = smoothstep(horizon, horizon - 0.02, r);
    vec3 color = (gas + streamers + rim) * (1.0 - inside);
    color *= 1.0 - uLayer * 0.35;

    float alpha = clamp(arms * outerFade * 1.2 + turbulence * 0.3 * outerFade + ring + halo + barbs * 0.7, 0.0, 1.0);
    alpha *= smoothstep(1.0, 0.8, r);
    gl_FragColor = vec4(color, max(alpha, inside));
  }
`

const PARTICLE_COUNT = 1200

/** A soft round dot, so embers are glowing specks instead of squares. */
function createEmberTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')!
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  glow.addColorStop(0, 'rgba(255,255,255,1)')
  glow.addColorStop(0.35, 'rgba(255,255,255,0.5)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = glow
  context.fillRect(0, 0, 64, 64)
  return new CanvasTexture(canvas)
}

/** The discs stacked into the pit, widest and brightest first. */
const LAYERS = [
  { scale: 1, depth: 0 },
  { scale: 0.74, depth: -0.9 },
  { scale: 0.5, depth: -1.8 },
] as const

/**
 * The black hole: one big, hungry pit below the escalators that everything
 * falls into. Embers spiral in, it glares brighter as someone nears the edge,
 * and it swells and flares each time it swallows a runner.
 */
export class BlackHoleMesh {
  readonly group = new Group()
  /** Where the hole is right now, easing toward where it was last asked to be. */
  readonly center: Vector3
  /** The radius the shader and particles are built at; the whole hole is scaled from it. */
  private readonly maxRadius: number
  private radius: number
  private goalRadius: number
  private goalCenterZ: number
  private readonly layers: { mesh: Mesh; material: ShaderMaterial; baseScale: number }[] = []
  private readonly light: PointLight
  private readonly emberTexture = createEmberTexture()
  private readonly particleGeometry = new BufferGeometry()
  private readonly particleRadius = new Float32Array(PARTICLE_COUNT)
  private readonly particleAngle = new Float32Array(PARTICLE_COUNT)
  private readonly particleHeight = new Float32Array(PARTICLE_COUNT)
  private readonly particlePositions = new Float32Array(PARTICLE_COUNT * 3)
  private time = 0
  private pulse = 0
  private hunger = 0

  constructor(maxRadius: number, radius: number, centerZ: number) {
    this.maxRadius = maxRadius
    this.radius = radius
    this.goalRadius = radius
    this.goalCenterZ = centerZ
    this.center = new Vector3(0, HOLE_DEPTH, centerZ)
    this.group.position.copy(this.center)
    this.group.scale.setScalar(radius / maxRadius)

    LAYERS.forEach(({ scale, depth }, layerIndex) => {
      const material = new ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uPulse: { value: 0 },
          uHunger: { value: 0 },
          uLayer: { value: layerIndex },
        },
        transparent: true,
        depthWrite: false,
      })
      const mesh = new Mesh(new CircleGeometry(maxRadius * scale, 128), material)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = depth
      this.group.add(mesh)
      this.layers.push({ mesh, material, baseScale: 1 })
    })

    for (let index = 0; index < PARTICLE_COUNT; index++) this.respawnParticle(index, true)
    this.particleGeometry.setAttribute('position', new BufferAttribute(this.particlePositions, 3))
    const embers = new Points(
      this.particleGeometry,
      new PointsMaterial({
        map: this.emberTexture,
        color: 0xff8a6a,
        size: 0.34,
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    )
    embers.frustumCulled = false
    this.group.add(embers)

    this.light = new PointLight(0xff2a1a, 60, maxRadius * 3.5, 1.3)
    this.light.position.set(0, 3, 0)
    this.group.add(this.light)
  }

  /** Where the hole should be, and how wide. It eases there rather than jumping. */
  setSize(radius: number, centerZ: number, instant = false): void {
    this.goalRadius = radius
    this.goalCenterZ = centerZ
    if (instant) {
      this.radius = radius
      this.applySize(centerZ)
    }
  }

  private applySize(centerZ: number): void {
    this.center.z = centerZ
    this.group.position.copy(this.center)
    this.group.scale.setScalar(this.radius / this.maxRadius)
  }

  /** 0 = nobody is in danger, 1 = someone is about to fall in. */
  setHunger(hunger: number): void {
    this.hunger = hunger
  }

  /** A runner has just been swallowed. */
  gulp(): void {
    this.pulse = 1
  }

  /** How hard the hole is thrashing right now, 0 to 1. Drives the camera shake. */
  get fury(): number {
    return Math.min(1, this.pulse + this.hunger * 0.25)
  }

  update(deltaSeconds: number): void {
    this.time += deltaSeconds
    this.pulse = Math.max(0, this.pulse - deltaSeconds * 0.9)

    const ease = 1 - Math.exp(-3 * deltaSeconds)
    this.radius += (this.goalRadius - this.radius) * ease
    this.applySize(this.center.z + (this.goalCenterZ - this.center.z) * ease)

    // A slow heartbeat that quickens as someone nears the edge.
    const heartbeat = Math.pow(Math.max(0, Math.sin(this.time * (2 + this.hunger * 3))), 6)
    const swell = 1 + this.pulse * 0.08 + this.hunger * 0.04 + heartbeat * 0.025

    for (const { mesh, material, baseScale } of this.layers) {
      material.uniforms.uTime!.value = this.time
      material.uniforms.uPulse!.value = this.pulse + heartbeat * 0.25
      material.uniforms.uHunger!.value = this.hunger
      mesh.scale.setScalar(baseScale * swell)
    }
    this.light.intensity = 60 + this.hunger * 80 + this.pulse * 220 + heartbeat * 30

    this.moveParticles(deltaSeconds)
  }

  dispose(): void {
    for (const { mesh, material } of this.layers) {
      mesh.geometry.dispose()
      material.dispose()
    }
    this.particleGeometry.dispose()
    this.emberTexture.dispose()
  }

  private moveParticles(deltaSeconds: number): void {
    const horizon = this.maxRadius * 0.27
    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const orbitalSpeed = 5 / Math.pow(this.particleRadius[index]!, 0.9)
      this.particleAngle[index]! += orbitalSpeed * deltaSeconds * 0.4
      this.particleRadius[index]! -= (0.5 + this.hunger * 0.8 + this.pulse * 2.5) * deltaSeconds
      if (this.particleRadius[index]! < horizon) this.respawnParticle(index, false)

      const radius = this.particleRadius[index]!
      const angle = this.particleAngle[index]!
      this.particlePositions[index * 3] = Math.cos(angle) * radius
      // Embers sag toward the centre, like a funnel.
      this.particlePositions[index * 3 + 1] =
        this.particleHeight[index]! * (radius / this.maxRadius) - (1 - radius / this.maxRadius) * 1.6
      this.particlePositions[index * 3 + 2] = Math.sin(angle) * radius
    }
    this.particleGeometry.attributes.position!.needsUpdate = true
  }

  private respawnParticle(index: number, anywhere: boolean): void {
    this.particleRadius[index] = anywhere
      ? MathUtils.lerp(this.maxRadius * 0.3, this.maxRadius, Math.random())
      : this.maxRadius * MathUtils.lerp(0.85, 1, Math.random())
    this.particleAngle[index] = Math.random() * Math.PI * 2
    this.particleHeight[index] = (Math.random() - 0.5) * 1.4
  }
}
