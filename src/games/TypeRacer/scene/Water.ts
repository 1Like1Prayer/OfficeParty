import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector3, Vector4 } from 'three'
import { SKY, STATION } from './stageConfig.ts'

const MAX_STATIONS = 12
const MAX_RIPPLES = 10

const VERTEX = `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;

  // Sum of a few travelling waves; returns height in x and the slope in yz.
  vec3 waves(vec2 p) {
    float height = 0.0;
    vec2 slope = vec2(0.0);
    vec4 w0 = vec4(1.0, 0.3, 0.55, 0.9);
    vec4 w1 = vec4(-0.6, 0.8, 0.9, 1.3);
    vec4 w2 = vec4(0.2, -1.0, 1.7, 1.9);
    vec4 w3 = vec4(-0.9, -0.4, 2.6, 2.4);
    for (int i = 0; i < 4; i++) {
      vec4 w = i == 0 ? w0 : (i == 1 ? w1 : (i == 2 ? w2 : w3));
      float phase = dot(w.xy, p) * w.z + uTime * w.w;
      float amplitude = 0.11 / w.z;
      height += sin(phase) * amplitude;
      slope += w.xy * w.z * cos(phase) * amplitude;
    }
    return vec3(height, slope);
  }

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 wave = waves(world.xz);
    world.y += wave.x;
    vWorld = world.xyz;
    vNormal = normalize(vec3(-wave.y, 1.0, -wave.z));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const FRAGMENT = `
  uniform float uTime;
  uniform vec3 uSunDirection;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uHorizon;
  uniform vec3 uStations[${MAX_STATIONS}];
  uniform vec4 uRipples[${MAX_RIPPLES}];
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorld);
    vec3 normal = normalize(vNormal);
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);

    vec3 color = mix(uDeep, uShallow, 0.25 + 0.75 * fresnel);

    // The sun on the water: a hot glint and a broad warm sheen toward it.
    vec3 reflected = reflect(-normalize(uSunDirection), normal);
    float glint = pow(max(dot(reflected, viewDirection), 0.0), 90.0);
    float sheen = pow(max(dot(reflected, viewDirection), 0.0), 8.0);
    color += vec3(1.0, 0.72, 0.45) * (glint * 1.6 + sheen * 0.18);
    color = mix(color, uHorizon, fresnel * 0.45);

    // Foam and a bright wake round each block; a station's radius is 0 once it has fallen.
    float foam = 0.0;
    for (int i = 0; i < ${MAX_STATIONS}; i++) {
      vec3 station = uStations[i];
      if (station.z <= 0.0) continue;
      float d = length(vWorld.xz - station.xy);
      float edge = station.z;
      float ring = smoothstep(0.55, 0.0, abs(d - edge - 0.12 - 0.05 * sin(uTime * 2.0 + d * 6.0)));
      foam += ring * 0.85;
    }
    // Rings spreading from where something hit the water.
    float ripple = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > 3.0) continue;
      float d = length(vWorld.xz - r.xy);
      float front = age * 3.2;
      float band = smoothstep(0.5, 0.0, abs(d - front));
      ripple += band * r.w * (1.0 - age / 3.0);
    }
    color = mix(color, vec3(0.92, 0.97, 1.0), clamp(foam + ripple, 0.0, 1.0) * 0.8);

    // Far water melts into the horizon.
    float distance = length(vWorld.xz - cameraPosition.xz);
    color = mix(color, uHorizon, smoothstep(60.0, 230.0, distance));
    gl_FragColor = vec4(color, 1.0);
  }
`

/**
 * The sea: waves that roll, the low sun glinting off them, foam round every
 * block and rings spreading wherever something falls in.
 */
export class Water {
  readonly mesh: Mesh
  private readonly material: ShaderMaterial
  private readonly stations = Array.from({ length: MAX_STATIONS }, () => new Vector3(0, 0, 0))
  private readonly ripples = Array.from({ length: MAX_RIPPLES }, () => new Vector4(0, 0, 0, 0))
  private nextRipple = 0
  private time = 0

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: new Vector3(...SKY.SUN_DIRECTION).normalize() },
        uDeep: { value: new Color(0x0b2a45) },
        uShallow: { value: new Color(0x2f8a9c) },
        uHorizon: { value: new Color(SKY.HORIZON) },
        uStations: { value: this.stations },
        uRipples: { value: this.ripples },
      },
      side: DoubleSide,
    })
    this.mesh = new Mesh(new PlaneGeometry(520, 520, 200, 200).rotateX(-Math.PI / 2), this.material)
    this.mesh.frustumCulled = false
  }

  /** Where a block stands, so foam rings it. A radius of 0 turns the foam off. */
  setStation(slot: number, x: number, z: number, radius: number): void {
    if (slot < MAX_STATIONS) this.stations[slot]!.set(x, z, radius)
  }

  /** Something hit the water here. */
  addRipple(x: number, z: number, strength = 1): void {
    this.ripples[this.nextRipple]!.set(x, z, this.time, strength)
    this.nextRipple = (this.nextRipple + 1) % MAX_RIPPLES
  }

  update(deltaSeconds: number): void {
    this.time += deltaSeconds
    this.material.uniforms.uTime!.value = this.time
  }

  /** The block's foam ring sits just outside its edge. */
  static readonly FOAM_RADIUS = STATION.BLOCK_RADIUS

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
