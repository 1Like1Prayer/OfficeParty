import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
} from 'three'

const COLUMN_RADIUS = 1.15
/** Tall enough to leave the top of the screen however high the runner is carried. */
const COLUMN_HEIGHT = 80
const PAD_RADIUS = 1.9

const COLUMN_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vHeight;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewPosition = viewPosition.xyz;
    vHeight = uv.y;
    gl_Position = projectionMatrix * viewPosition;
  }
`

/**
 * A round column of light. Its brightness falls off toward the silhouette,
 * which is what makes a flat-coloured cylinder read as a solid round shaft,
 * and it fades out with height. Energy streaks race up it.
 */
const COLUMN_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vHeight;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(-vViewPosition)));
    float body = pow(facing, 1.6);
    float rim = pow(1.0 - facing, 3.0) * 0.5;
    float fade = pow(1.0 - vHeight, 0.7);
    float streaks = 0.82 + 0.18 * sin(vHeight * ${COLUMN_HEIGHT.toFixed(1)} * 0.6 - uTime * 9.0);
    float alpha = (body * 0.55 + rim) * fade * streaks * uStrength;
    gl_FragColor = vec4(uColor * (0.6 + 0.8 * body), alpha);
  }
`

const PAD_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** A pool of light on the ground under the runner, with a bright rim that pulses. */
const PAD_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float radius = length(vUv - 0.5) * 2.0;
    if (radius > 1.0) discard;
    float pool = smoothstep(1.0, 0.2, radius) * 0.5;
    float ring = smoothstep(0.1, 0.0, abs(radius - (0.78 + 0.05 * sin(uTime * 6.0)))) * 0.9;
    gl_FragColor = vec4(uColor * 1.3, (pool + ring) * uStrength);
  }
`

const makeMaterial = (vertexShader: string, fragmentShader: string, color: Color): ShaderMaterial =>
  new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: color },
      uTime: { value: 0 },
      uStrength: { value: 0 },
    },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  })

/**
 * The light that lifts a runner and sets them down: a round column wrapping
 * their whole body from their feet up out of sight, with a glowing pad where
 * they stand. Fades in and out with `setStrength`.
 */
export class LightBeam {
  readonly group = new Group()
  private readonly column: Mesh
  private readonly pad: Mesh
  private readonly materials: ShaderMaterial[]
  private time = 0

  constructor(color = 0xbfeaff) {
    const tint = new Color(color)
    const columnMaterial = makeMaterial(COLUMN_VERTEX, COLUMN_FRAGMENT, tint)
    const padMaterial = makeMaterial(PAD_VERTEX, PAD_FRAGMENT, tint)
    this.materials = [columnMaterial, padMaterial]

    this.column = new Mesh(new CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, COLUMN_HEIGHT, 48, 1, true), columnMaterial)
    // Starts just below the feet and runs up past the top of the screen.
    this.column.position.y = COLUMN_HEIGHT / 2 - 0.4

    this.pad = new Mesh(new CircleGeometry(PAD_RADIUS, 48), padMaterial)
    this.pad.rotation.x = -Math.PI / 2
    this.pad.position.y = 0.04

    this.group.add(this.column, this.pad)
    this.group.visible = false
  }

  /** 0 = off, 1 = full. */
  setStrength(strength: number): void {
    for (const material of this.materials) material.uniforms.uStrength!.value = strength
    this.group.visible = strength > 0.001
  }

  update(deltaSeconds: number): void {
    this.time += deltaSeconds
    for (const material of this.materials) material.uniforms.uTime!.value = this.time
  }

  dispose(): void {
    this.column.geometry.dispose()
    this.pad.geometry.dispose()
    for (const material of this.materials) material.dispose()
  }
}
