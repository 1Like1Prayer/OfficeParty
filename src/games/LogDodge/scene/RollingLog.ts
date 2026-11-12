import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import type { LogHeight } from '../../../shared/games/logDodge/types.ts'
import { LOG, LOG_HEIGHT, LOG_RADIUS } from './sceneConfig.ts'

/** Bark: long dark furrows running the length of the trunk, so a roll shows. */
function createBarkTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 8
  const context = canvas.getContext('2d')!
  context.fillStyle = '#9a6a35'
  context.fillRect(0, 0, 256, 8)
  // Pseudo-random but fixed, so every log wears the same bark.
  let seed = 11
  const next = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let furrow = 0; furrow < 46; furrow++) {
    const x = next() * 256
    context.fillStyle = next() > 0.45 ? '#6e4720' : '#b98446'
    context.fillRect(x, 0, 1 + next() * 5, 8)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  return texture
}

/** The cut end of a trunk: pale wood with growth rings. */
function createEndTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')!
  context.fillStyle = '#e2b574'
  context.fillRect(0, 0, 128, 128)
  context.strokeStyle = '#b07c3c'
  context.lineWidth = 3
  for (let radius = 8; radius < 64; radius += 11) {
    context.beginPath()
    context.arc(64, 64, radius, 0, Math.PI * 2)
    context.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** What every log shares, built once. */
export class LogShared {
  readonly bark = createBarkTexture()
  readonly end = createEndTexture()
  private readonly geometries: Record<LogHeight, CylinderGeometry> = {
    low: new CylinderGeometry(LOG_RADIUS.low, LOG_RADIUS.low, LOG.LENGTH, 20),
    high: new CylinderGeometry(LOG_RADIUS.high, LOG_RADIUS.high, LOG.LENGTH, 20),
  }

  geometry(height: LogHeight): CylinderGeometry {
    return this.geometries[height]
  }

  dispose(): void {
    this.bark.dispose()
    this.end.dispose()
    Object.values(this.geometries).forEach((geometry) => { geometry.dispose() })
  }
}

/**
 * One log: a long trunk that rolls toward the contestants, across the running
 * surface of the treadmill, so there is no getting round it — only over or
 * under.
 * It is told where it is each frame and holds no schedule of its own.
 */
export class RollingLog {
  readonly group = new Group()
  private readonly trunk: Mesh
  private readonly materials: MeshStandardMaterial[]
  private readonly radius: number
  private span = 1

  constructor(height: LogHeight, shared: LogShared) {
    this.radius = LOG_RADIUS[height]
    const side = new MeshStandardMaterial({ map: shared.bark, roughness: 0.9, transparent: true })
    const end = new MeshStandardMaterial({ map: shared.end, roughness: 0.8, transparent: true })
    this.materials = [side, end]

    // A cylinder stands on Y; turned on its side it runs along X. Its caps are the last two groups.
    this.trunk = new Mesh(shared.geometry(height), [side, end, end])
    this.trunk.rotation.z = Math.PI / 2
    this.trunk.castShadow = true
    this.trunk.receiveShadow = true
    this.group.add(this.trunk)
    this.group.position.y = LOG_HEIGHT[height]
    this.group.visible = false
  }

  /** How wide the running belt is, which is how long the log is, less a margin. */
  setSpan(width: number): void {
    this.span = width
  }

  /**
   * `z` is how far along the deck it is, `tilt` how far it is swung round (a
   * log straightens as it arrives), and `fade` how much of it shows yet.
   */
  place({ z, tilt, fade }: { z: number; tilt: number; fade: number }): void {
    this.group.visible = fade > 0
    if (fade <= 0) return
    this.group.position.z = z
    this.group.rotation.y = tilt
    // Stretched as it swings, so its ends stay at the belt's edges however it is turned.
    const stretch = 1 / Math.max(LOG.MIN_COS_TILT, Math.cos(tilt))
    this.trunk.scale.y = ((this.span - LOG.INSET * 2) * stretch) / LOG.LENGTH
    // Rolling toward the camera: the top of the trunk moves toward +Z.
    this.trunk.rotation.x = z / this.radius
    for (const material of this.materials) material.opacity = fade
  }

  hide(): void {
    this.group.visible = false
  }

  dispose(): void {
    this.materials.forEach((material) => { material.dispose() })
  }
}
