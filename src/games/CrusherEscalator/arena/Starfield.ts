import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
} from 'three'

const SKY_RADIUS = 380
const STAR_COUNT = 7000

const NEBULA_VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** Faint drifting clouds of colour, so the sky is never flat black between stars. */
const NEBULA_FRAGMENT = `
  uniform float uTime;
  varying vec3 vDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave++) {
      value += amplitude * noise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 direction = normalize(vDirection);
    vec3 drift = direction * 2.2 + vec3(uTime * 0.004, 0.0, 0.0);
    float clouds = smoothstep(0.42, 0.9, fbm(drift));
    float wisps = smoothstep(0.5, 0.95, fbm(drift * 2.7 + 9.0));

    vec3 base = mix(vec3(0.02, 0.01, 0.07), vec3(0.05, 0.02, 0.12), direction.y * 0.5 + 0.5);
    vec3 violet = vec3(0.30, 0.08, 0.55);
    vec3 teal = vec3(0.04, 0.30, 0.45);
    vec3 crimson = vec3(0.45, 0.05, 0.18);
    vec3 color = base + violet * clouds * 0.55 + teal * wisps * 0.35 + crimson * clouds * wisps * 0.4;
    gl_FragColor = vec4(color, 1.0);
  }
`

const STAR_VERTEX = `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aTint;
  uniform float uTime;
  varying vec3 vTint;
  varying float vBrightness;
  void main() {
    vTint = aTint;
    vBrightness = 0.65 + 0.35 * sin(uTime * (0.6 + aPhase) + aPhase * 40.0);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (0.8 + 0.2 * vBrightness);
    gl_Position = projectionMatrix * viewPosition;
  }
`

const STAR_FRAGMENT = `
  varying vec3 vTint;
  varying float vBrightness;
  void main() {
    float distanceFromCenter = length(gl_PointCoord - 0.5);
    float glow = smoothstep(0.5, 0.0, distanceFromCenter);
    gl_FragColor = vec4(vTint * vBrightness, glow * glow);
  }
`

/** A uniformly random point on the unit sphere. */
const randomDirection = (): [number, number, number] => {
  const z = Math.random() * 2 - 1
  const angle = Math.random() * Math.PI * 2
  const ring = Math.sqrt(1 - z * z)
  return [ring * Math.cos(angle), z, ring * Math.sin(angle)]
}

/**
 * The sky: a nebula-tinted dome with thousands of twinkling stars scattered
 * across all of it. Stars come in a range of sizes and warm-to-cool tints, and
 * a few are bright enough to read as the real thing.
 */
export class Starfield {
  readonly group = new Group()
  private readonly nebulaMaterial: ShaderMaterial
  private readonly starMaterial: ShaderMaterial
  private readonly geometries: BufferGeometry[] = []

  constructor() {
    this.nebulaMaterial = new ShaderMaterial({
      vertexShader: NEBULA_VERTEX,
      fragmentShader: NEBULA_FRAGMENT,
      uniforms: { uTime: { value: 0 } },
      side: BackSide,
      depthWrite: false,
      fog: false,
    })
    const dome = new Mesh(new SphereGeometry(SKY_RADIUS * 1.05, 48, 32), this.nebulaMaterial)
    this.geometries.push(dome.geometry)
    this.group.add(dome)

    const positions = new Float32Array(STAR_COUNT * 3)
    const sizes = new Float32Array(STAR_COUNT)
    const phases = new Float32Array(STAR_COUNT)
    const tints = new Float32Array(STAR_COUNT * 3)
    const palette: [number, number, number][] = [
      [1, 1, 1],
      [0.75, 0.85, 1],
      [1, 0.92, 0.75],
      [1, 0.78, 0.7],
    ]

    for (let index = 0; index < STAR_COUNT; index++) {
      const [x, y, z] = randomDirection()
      positions.set([x * SKY_RADIUS, y * SKY_RADIUS, z * SKY_RADIUS], index * 3)
      // Mostly pinpricks, with the occasional bright one.
      const brightness = Math.pow(Math.random(), 5)
      sizes[index] = 1.6 + brightness * 7
      phases[index] = Math.random()
      tints.set(palette[Math.floor(Math.random() * palette.length)]!, index * 3)
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
    geometry.setAttribute('aPhase', new BufferAttribute(phases, 1))
    geometry.setAttribute('aTint', new BufferAttribute(tints, 3))
    this.geometries.push(geometry)

    this.starMaterial = new ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      fog: false,
    })
    const stars = new Points(geometry, this.starMaterial)
    stars.frustumCulled = false
    this.group.add(stars)
  }

  update(elapsedSeconds: number): void {
    this.nebulaMaterial.uniforms.uTime!.value = elapsedSeconds
    this.starMaterial.uniforms.uTime!.value = elapsedSeconds
  }

  dispose(): void {
    this.geometries.forEach((geometry) => { geometry.dispose() })
    this.nebulaMaterial.dispose()
    this.starMaterial.dispose()
  }
}
