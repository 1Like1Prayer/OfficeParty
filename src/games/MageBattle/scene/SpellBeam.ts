import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  Points,
  PointsMaterial,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'

/**
 * Shared by the core and the aura: the beam wavers, ripples running along it
 * toward the middle, and flares out a little where it meets the clash.
 * `vAlong` runs 0 at the wand to 1 at the clash.
 */
const VERTEX = `
  uniform float uTime;
  uniform float uLength;
  uniform float uWobble;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vAlong;
  varying float vAround;
  void main() {
    vAlong = uv.y;
    vAround = uv.x;
    float ripple = 1.0 + uWobble * sin(uv.y * uLength * 2.2 - uTime * 18.0);
    float flare = mix(0.65, 1.2, smoothstep(0.55, 1.0, uv.y));
    vec3 moved = vec3(position.x * ripple * flare, position.y, position.z * ripple * flare);
    vec4 viewPosition = modelViewMatrix * vec4(moved, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`

/**
 * The core: white-hot in the middle, the caster's colour at the edge, with a
 * double helix of brighter energy twisting along it and pulses racing in.
 */
const CORE_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  uniform float uLength;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vAlong;
  varying float vAround;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(-vViewPosition)));
    float core = pow(facing, 3.0);
    float glow = pow(facing, 0.8);
    float helix = pow(0.5 + 0.5 * sin(vAround * 12.566 + vAlong * uLength * 1.8 - uTime * 13.0), 6.0);
    float pulses = 0.7 + 0.3 * sin(vAlong * uLength * 2.4 - uTime * 16.0);
    float ends = smoothstep(0.0, 0.05, vAlong);
    float alpha = (glow * 0.5 + core * 1.0 + helix * 0.6) * pulses * ends * uStrength;
    vec3 tint = mix(uColor * 1.5, vec3(1.0), clamp(core * 0.9 + helix * 0.35, 0.0, 1.0));
    gl_FragColor = vec4(tint, alpha);
  }
`

/** The aura: a wide, soft sheath of the caster's colour round the core, breathing as it goes. */
const AURA_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  uniform float uLength;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vAlong;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(-vViewPosition)));
    float soft = pow(facing, 2.2);
    float breathe = 0.75 + 0.25 * sin(vAlong * uLength * 0.9 - uTime * 7.0);
    float ends = smoothstep(0.0, 0.12, vAlong);
    gl_FragColor = vec4(uColor * 1.2, soft * 0.32 * breathe * ends * uStrength);
  }
`

const UP = new Vector3(0, 1, 0)
/** How much wider than the core the aura is. */
const AURA_SCALE = 3.4
/** Motes of light streaming down each beam into the clash. */
const MOTE_COUNT = 28

let moteTexture: CanvasTexture | null = null
let moteTextureUsers = 0

/** A soft round dot, so the motes glow rather than show as squares. Shared by every beam. */
function acquireMoteTexture(): CanvasTexture {
  moteTextureUsers++
  if (moteTexture !== null) return moteTexture
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.6)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  moteTexture = new CanvasTexture(canvas)
  return moteTexture
}

function releaseMoteTexture(): void {
  moteTextureUsers--
  if (moteTextureUsers === 0 && moteTexture !== null) {
    moteTexture.dispose()
    moteTexture = null
  }
}

/** A spell beam from a wand to the middle of the circle: a core, an aura round it, and motes of light running down it. */
export class SpellBeam {
  /** Everything the beam draws; add this to the scene. */
  readonly mesh = new Group()
  private readonly geometry = new CylinderGeometry(1, 1, 1, 24, 24, true)
  private readonly core: Mesh
  private readonly aura: Mesh
  private readonly coreMaterial: ShaderMaterial
  private readonly auraMaterial: ShaderMaterial
  private readonly motes: Points
  private readonly moteGeometry = new BufferGeometry()
  private readonly moteMaterial: PointsMaterial
  private readonly moteSeeds = Array.from({ length: MOTE_COUNT }, () => ({
    offset: Math.random(),
    speed: 0.7 + Math.random() * 0.8,
    angle: Math.random() * Math.PI * 2,
    spread: 0.6 + Math.random() * 1.8,
  }))
  private readonly direction = new Vector3()
  private readonly turn = new Quaternion()

  constructor(color: string) {
    const uniforms = () => ({
      uColor: { value: new Color(color) },
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uLength: { value: 1 },
      uWobble: { value: 0.12 },
    })
    const material = (fragmentShader: string) =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader,
        uniforms: uniforms(),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      })
    this.coreMaterial = material(CORE_FRAGMENT)
    this.auraMaterial = material(AURA_FRAGMENT)
    this.auraMaterial.uniforms.uWobble!.value = 0.2
    // A unit cylinder, stretched and turned into place every frame.
    this.core = new Mesh(this.geometry, this.coreMaterial)
    this.aura = new Mesh(this.geometry, this.auraMaterial)
    this.aura.scale.set(AURA_SCALE, 1, AURA_SCALE)
    this.core.renderOrder = 3
    this.aura.renderOrder = 2

    this.moteGeometry.setAttribute('position', new BufferAttribute(new Float32Array(MOTE_COUNT * 3), 3))
    this.moteMaterial = new PointsMaterial({
      color: new Color(color).lerp(new Color(0xffffff), 0.55),
      size: 0.22,
      map: acquireMoteTexture(),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    this.motes = new Points(this.moteGeometry, this.moteMaterial)
    this.motes.renderOrder = 4
    this.motes.frustumCulled = false

    this.mesh.add(this.aura, this.core, this.motes)
    this.mesh.visible = false
  }

  /**
   * Runs the beam from `from` toward `to`, `reach` (0..1) of the way there,
   * `radius` thick and `strength` bright.
   */
  update(from: Vector3, to: Vector3, reach: number, radius: number, strength: number, timeSeconds: number): void {
    this.direction.subVectors(to, from)
    const length = this.direction.length() * reach
    this.mesh.visible = reach > 0.001 && strength > 0.001
    if (!this.mesh.visible) return
    this.direction.normalize()
    this.turn.setFromUnitVectors(UP, this.direction)
    this.mesh.quaternion.copy(this.turn)
    this.mesh.position.copy(from).addScaledVector(this.direction, length / 2)
    // The group is one unit long and `radius` wide; the core and aura sit inside it.
    this.mesh.scale.set(radius, length, radius)
    for (const material of [this.coreMaterial, this.auraMaterial]) {
      const uniforms = material.uniforms
      uniforms.uStrength!.value = strength
      uniforms.uLength!.value = length
      uniforms.uTime!.value = timeSeconds
    }

    // The motes run from the wand to the clash and start again; in the group's stretched space, so x and z are in radii.
    const positions = this.moteGeometry.getAttribute('position') as BufferAttribute
    this.moteSeeds.forEach((seed, index) => {
      const along = (seed.offset + timeSeconds * seed.speed * (6 / Math.max(length, 1))) % 1
      const swirl = seed.angle + timeSeconds * 3 + along * 6
      const spread = seed.spread * (1 - along * 0.5)
      positions.setXYZ(index, Math.cos(swirl) * spread, along - 0.5, Math.sin(swirl) * spread)
    })
    positions.needsUpdate = true
    this.moteMaterial.opacity = Math.min(1, strength)
  }

  dispose(): void {
    this.geometry.dispose()
    this.coreMaterial.dispose()
    this.auraMaterial.dispose()
    this.moteGeometry.dispose()
    this.moteMaterial.dispose()
    releaseMoteTexture()
  }
}
