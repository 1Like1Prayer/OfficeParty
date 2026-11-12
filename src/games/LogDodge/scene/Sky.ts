import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { HORIZON_COLOR, SKY_TOP_COLOR } from './sceneConfig.ts'

const DOME_RADIUS = 360

const VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** Deep blue overhead, fading to haze at the horizon, so the sea melts into the sky. */
const FRAGMENT = `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  varying vec3 vDirection;
  void main() {
    float height = clamp(vDirection.y, 0.0, 1.0);
    gl_FragColor = vec4(mix(uHorizon, uTop, pow(height, 0.55)), 1.0);
  }
`

/** A soft round glow: white in the middle, nothing at the edge. */
function createGlowTexture(inner: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(inner, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** A cloud: a few overlapping puffs, flat-bottomed. */
function createCloudTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')!
  const puffs: [number, number, number][] = [
    [60, 62, 30], [100, 46, 38], [150, 52, 36], [195, 64, 28], [128, 70, 34],
  ]
  for (const [x, y, radius] of puffs) {
    const gradient = context.createRadialGradient(x, y, radius * 0.2, x, y, radius)
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 96)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Where the sun sits in the sky: ahead and to the left, so it is in view as you run. */
const SUN_DIRECTION = new Vector3(-0.35, 0.42, -1).normalize()

/**
 * A bright blue sky with a sun and a few clouds, painted on a dome that
 * follows the camera so it can never be reached.
 */
export class Sky {
  readonly group = new Group()
  private readonly dome: Mesh
  private readonly textures: CanvasTexture[] = []
  private readonly disposables: { dispose: () => void }[] = []

  constructor() {
    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTop: { value: new Color(SKY_TOP_COLOR) },
        uHorizon: { value: new Color(HORIZON_COLOR) },
      },
      side: BackSide,
      depthWrite: false,
      fog: false,
    })
    const geometry = new SphereGeometry(DOME_RADIUS, 32, 16)
    this.disposables.push(material, geometry)
    this.dome = new Mesh(geometry, material)
    this.dome.renderOrder = -2
    this.group.add(this.dome)

    const glow = createGlowTexture(0.25)
    const halo = createGlowTexture(0.05)
    const cloud = createCloudTexture()
    this.textures.push(glow, halo, cloud)

    const sun = this.sprite(glow, 0xfff6d0, 46, 1)
    sun.position.copy(SUN_DIRECTION).multiplyScalar(DOME_RADIUS * 0.9)
    const corona = this.sprite(halo, 0xffe9a8, 190, 0.55)
    corona.position.copy(sun.position)
    this.group.add(corona, sun)

    // Fixed, so the sky is the same every round.
    const clouds: [number, number, number, number][] = [
      [-0.9, 0.32, -1, 70], [0.7, 0.4, -1, 90], [-0.2, 0.55, -1, 60],
      [1, 0.28, -0.4, 80], [-1, 0.35, -0.3, 75], [0.4, 0.62, -0.6, 55],
    ]
    for (const [x, y, z, size] of clouds) {
      const puff = this.sprite(cloud, 0xffffff, size, 0.95, false)
      puff.scale.set(size * 2.6, size, 1)
      puff.position.set(x, y, z).normalize().multiplyScalar(DOME_RADIUS * 0.85)
      this.group.add(puff)
    }
  }

  /** Keeps the dome centred on the camera, so the horizon never comes nearer. */
  follow(cameraPosition: Vector3): void {
    this.group.position.copy(cameraPosition)
  }

  dispose(): void {
    this.textures.forEach((texture) => { texture.dispose() })
    this.disposables.forEach((item) => { item.dispose() })
    this.group.traverse((object) => {
      if (object instanceof Sprite) object.material.dispose()
    })
  }

  private sprite(map: CanvasTexture, tint: number, size: number, opacity: number, glows = true): Sprite {
    const sprite = new Sprite(
      new SpriteMaterial({
        map,
        color: tint,
        transparent: true,
        opacity,
        depthWrite: false,
        fog: false,
        blending: glows ? AdditiveBlending : undefined,
      }),
    )
    sprite.scale.setScalar(size)
    sprite.renderOrder = -1
    return sprite
  }
}
