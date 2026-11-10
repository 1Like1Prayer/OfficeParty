import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { SKY } from './stageConfig.ts'

const VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** Dusk: a glowing horizon, a deep indigo overhead, a low sun, soft clouds and the first stars. */
const FRAGMENT = `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uSunDirection;
  uniform float uTime;
  varying vec3 vDirection;

  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDirection);
    float height = clamp(d.y, 0.0, 1.0);
    vec3 color = mix(uHorizon, uZenith, pow(height, 0.55));
    // A warmer band just over the horizon.
    color += vec3(0.35, 0.12, 0.05) * exp(-height * 9.0);

    // The sun, and the glow round it.
    float sun = max(dot(d, normalize(uSunDirection)), 0.0);
    color += vec3(1.0, 0.62, 0.3) * pow(sun, 24.0) * 0.55;
    color += vec3(1.0, 0.85, 0.6) * smoothstep(0.9985, 0.9997, sun) * 2.0;

    // Clouds, drifting, lit from the sun's side.
    vec2 cloudUv = d.xz / (d.y + 0.35) * 1.6 + vec2(uTime * 0.01, 0.0);
    float cloud = smoothstep(0.52, 0.85, fbm(cloudUv)) * smoothstep(0.0, 0.25, d.y);
    vec3 cloudColor = mix(vec3(0.45, 0.25, 0.35), vec3(1.0, 0.62, 0.4), pow(sun, 3.0) + 0.2);
    color = mix(color, cloudColor, cloud * 0.7);

    // Stars, in the dark of the upper sky.
    vec2 starUv = d.xz / (d.y + 0.2) * 90.0;
    float star = step(0.9965, hash(floor(starUv))) * smoothstep(0.35, 0.8, d.y);
    color += vec3(star) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(floor(starUv)) * 40.0));

    gl_FragColor = vec4(color, 1.0);
  }
`

/** The sky, drawn on the inside of a huge sphere that never moves with the camera. */
export class SkyDome {
  readonly mesh: Mesh
  private readonly material: ShaderMaterial

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uHorizon: { value: new Color(SKY.HORIZON) },
        uZenith: { value: new Color(SKY.ZENITH) },
        uSunDirection: { value: new Vector3(...SKY.SUN_DIRECTION).normalize() },
        uTime: { value: 0 },
      },
      side: BackSide,
      depthWrite: false,
      fog: false,
    })
    this.mesh = new Mesh(new SphereGeometry(900, 48, 32), this.material)
    this.mesh.renderOrder = -1
  }

  update(elapsedSeconds: number): void {
    this.material.uniforms.uTime!.value = elapsedSeconds
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
