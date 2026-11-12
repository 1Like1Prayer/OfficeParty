import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { MINEFIELD } from '../../../shared/games/minefield/constants.ts'
import type { MinefieldMap } from '../../../shared/games/minefield/types.ts'

const SAND = '#e6cf9a'

/** A cheap deterministic pseudo-random, so the scenery is the same on every screen. */
const seeded = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const smooth = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function sandTexture(): CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  context.fillStyle = SAND
  context.fillRect(0, 0, size, size)
  const random = seeded(7)
  // Soft mottling, then ripples, then grains.
  for (let blob = 0; blob < 140; blob++) {
    const x = random() * size
    const y = random() * size
    const radius = 20 + random() * 60
    const light = random() > 0.5
    // Drawn again one tile over in each direction, so the texture has no seam when it repeats.
    for (const shiftX of [-size, 0, size]) {
      for (const shiftY of [-size, 0, size]) {
        const gradient = context.createRadialGradient(x + shiftX, y + shiftY, 0, x + shiftX, y + shiftY, radius)
        gradient.addColorStop(0, light ? 'rgba(255,240,200,0.28)' : 'rgba(190,150,90,0.22)')
        gradient.addColorStop(1, 'rgba(0,0,0,0)')
        context.fillStyle = gradient
        context.fillRect(x + shiftX - radius, y + shiftY - radius, radius * 2, radius * 2)
      }
    }
  }
  context.lineWidth = 2
  for (let ripple = 0; ripple < 38; ripple++) {
    const y = random() * size
    context.strokeStyle = random() > 0.5 ? 'rgba(255,245,215,0.22)' : 'rgba(170,130,75,0.2)'
    context.beginPath()
    for (let x = 0; x <= size; x += 16) {
      const wave = y + Math.sin((x / size) * Math.PI * 2 * 7 + ripple) * 4
      if (x === 0) context.moveTo(x, wave)
      else context.lineTo(x, wave)
    }
    context.stroke()
  }
  for (let grain = 0; grain < 5000; grain++) {
    context.fillStyle = random() > 0.5 ? 'rgba(255,250,230,0.35)' : 'rgba(150,110,60,0.3)'
    context.fillRect(random() * size, random() * size, 1.5, 1.5)
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function bannerTexture(text: string, checkered: boolean): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext('2d')!
  context.fillStyle = '#fffaf0'
  context.fillRect(0, 0, 512, 128)
  if (checkered) {
    for (let column = 0; column < 32; column++) {
      for (let row = 0; row < 8; row++) {
        if ((column + row) % 2 === 0) {
          context.fillStyle = '#2E2A45'
          context.fillRect(column * 16, row * 16, 16, 16)
        }
      }
    }
    context.fillStyle = '#fffaf0'
    context.fillRect(96, 24, 320, 80)
  }
  context.fillStyle = '#2E2A45'
  context.font = '900 78px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 256, 68)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function stripeTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 1024
  const context = canvas.getContext('2d')!
  for (let row = 0; row < 32; row++) {
    for (let column = 0; column < 2; column++) {
      context.fillStyle = (row + column) % 2 === 0 ? '#ffffff' : '#2E2A45'
      context.fillRect(column * 32, row * 32, 32, 32)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * The desert the minefield lies in: sand underfoot with dunes beyond the field,
 * a rope along each side, a start gate and a finish arch, and a little scenery.
 */
export class World {
  readonly group = new Group()
  private readonly disposables: { dispose: () => void }[] = []
  private readonly tileScale: number

  constructor(tiles: MinefieldMap, tileScale: number) {
    // Everything below is laid out in world units, so each tile is `tileScale` of them.
    const map: MinefieldMap = {
      ...tiles,
      width: tiles.width * tileScale,
      height: tiles.height * tileScale,
      finishX: tiles.finishX * tileScale,
    }
    this.tileScale = tileScale
    this.addGround(map)
    this.addRopes(map)
    this.addGate(map, 0.2, 'START', false)
    this.addGate(map, map.finishX, 'FINISH', true)
    this.addFinishStrip(map)
    this.addScenery(map)
  }

  dispose(): void {
    this.disposables.forEach((item) => { item.dispose() })
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item)
    return item
  }

  private addGround(map: MinefieldMap): void {
    const width = 420
    const depth = 260
    const geometry = this.track(new PlaneGeometry(width, depth, 210, 130))
    const cx = map.width / 2
    const cz = map.height / 2
    const position = geometry.attributes.position!
    // Flat across the field, rolling into dunes beyond it.
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index) + cx
      const z = -position.getY(index) + cz
      const outsideX = Math.max(0, Math.abs(x - cx) - (map.width / 2 + 4))
      const outsideZ = Math.max(0, Math.abs(z - cz) - (map.height / 2 + 4))
      const away = Math.hypot(outsideX, outsideZ)
      const dune =
        Math.sin(x * 0.07 + z * 0.03) * 2.4 + Math.sin(z * 0.11 - x * 0.05) * 1.6 + Math.sin(x * 0.19 + z * 0.17) * 0.5
      position.setZ(index, (dune + 3.2) * smooth(0, 26, away))
    }
    geometry.computeVertexNormals()

    const texture = this.track(sandTexture())
    texture.repeat.set(width / 7, depth / 7)
    const ground = new Mesh(geometry, this.track(new MeshStandardMaterial({ map: texture, roughness: 1 })))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(cx, 0, cz)
    ground.receiveShadow = true
    this.group.add(ground)

    // A band of darker, packed sand where the minefield lies, so its edges read.
    const field = new Mesh(
      this.track(new PlaneGeometry(map.width, map.height)),
      this.track(new MeshBasicMaterial({ color: 0xb08a4a, transparent: true, opacity: 0.1 })),
    )
    field.rotation.x = -Math.PI / 2
    field.position.set(cx, 0.015, cz)
    this.group.add(field)
  }

  private addRopes(map: MinefieldMap): void {
    const postGeometry = this.track(new CylinderGeometry(0.07, 0.09, 1, 8))
    const postMaterial = this.track(new MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 }))
    const spacing = 3 * this.tileScale
    const count = Math.floor(map.width / spacing) + 1
    const posts = new InstancedMesh(postGeometry, postMaterial, count * 2)
    posts.castShadow = true
    const matrix = new Matrix4()
    let slot = 0
    for (const z of [-0.2, map.height + 0.2]) {
      for (let index = 0; index < count; index++) {
        matrix.compose(new Vector3(index * spacing, 0.5, z), new Quaternion(), new Vector3(1, 1, 1))
        posts.setMatrixAt(slot++, matrix)
      }
    }
    this.group.add(posts)

    const ropeMaterial = this.track(new MeshStandardMaterial({ color: 0xd8c08a, roughness: 1 }))
    const ropeGeometry = this.track(new BoxGeometry(map.width, 0.05, 0.05))
    for (const z of [-0.2, map.height + 0.2]) {
      for (const y of [0.85, 0.55]) {
        const rope = new Mesh(ropeGeometry, ropeMaterial)
        rope.position.set(map.width / 2, y, z)
        this.group.add(rope)
      }
    }
  }

  private addGate(map: MinefieldMap, x: number, text: string, checkered: boolean): void {
    const postGeometry = this.track(new CylinderGeometry(0.16, 0.2, 4.2, 10))
    const postMaterial = this.track(new MeshStandardMaterial({ color: 0xf4efe0, roughness: 0.6 }))
    for (const z of [-0.8, map.height + 0.8]) {
      const post = new Mesh(postGeometry, postMaterial)
      post.position.set(x, 2.1, z)
      post.castShadow = true
      this.group.add(post)
    }
    const banner = new Mesh(
      this.track(new PlaneGeometry(map.height + 1.6, (map.height + 1.6) / 4)),
      this.track(
        new MeshBasicMaterial({ map: this.track(bannerTexture(text, checkered)), side: DoubleSide }),
      ),
    )
    // Hangs across the field between the posts, tilted to face the way they will come from.
    banner.rotation.y = Math.PI / 2
    banner.scale.y = 0.42
    banner.position.set(x, 3.7, map.height / 2)
    this.group.add(banner)
  }

  private addFinishStrip(map: MinefieldMap): void {
    const strip = new Mesh(
      this.track(new PlaneGeometry(0.9, map.height)),
      this.track(new MeshBasicMaterial({ map: this.track(stripeTexture()) })),
    )
    strip.rotation.x = -Math.PI / 2
    strip.position.set(map.finishX + 0.45, 0.03, map.height / 2)
    this.group.add(strip)

    // Where mines can no longer be, near the start: a faint line to show it.
    const safe = new Mesh(
      this.track(new PlaneGeometry(0.12, map.height)),
      this.track(new MeshBasicMaterial({ color: 0x8a5a2b, transparent: true, opacity: 0.35 })),
    )
    safe.rotation.x = -Math.PI / 2
    safe.position.set(MINEFIELD.START_SAFE_TILES * this.tileScale, 0.03, map.height / 2)
    this.group.add(safe)
  }

  private addScenery(map: MinefieldMap): void {
    const random = seeded(21)
    const outside = (): { x: number; z: number } => {
      for (;;) {
        const x = -30 + random() * (map.width + 90)
        const z = -38 + random() * (map.height + 76)
        if (x < -2 || x > map.width + 3 || z < -3.5 || z > map.height + 3.5) return { x, z }
      }
    }

    // Boulders.
    const rockGeometry = this.track(new DodecahedronGeometry(1, 0))
    const rockMaterial = this.track(new MeshStandardMaterial({ color: 0xb59a76, roughness: 1, flatShading: true }))
    const rocks = new InstancedMesh(rockGeometry, rockMaterial, 60)
    const matrix = new Matrix4()
    for (let index = 0; index < 60; index++) {
      const { x, z } = outside()
      const size = 0.4 + random() * 1.5
      matrix.compose(
        new Vector3(x, size * 0.3, z),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), random() * 6),
        new Vector3(size, size * 0.7, size),
      )
      rocks.setMatrixAt(index, matrix)
    }
    rocks.castShadow = true
    rocks.receiveShadow = true
    this.group.add(rocks)

    // Cacti.
    const green = this.track(new MeshStandardMaterial({ color: 0x5b8f4a, roughness: 0.8 }))
    const trunk = this.track(new CylinderGeometry(0.28, 0.32, 2.2, 10))
    const arm = this.track(new CylinderGeometry(0.17, 0.2, 0.9, 8))
    const top = this.track(new ConeGeometry(0.28, 0.4, 10))
    for (let index = 0; index < 22; index++) {
      const { x, z } = outside()
      const cactus = new Group()
      const stem = new Mesh(trunk, green)
      stem.position.y = 1.1
      cactus.add(stem)
      const cap = new Mesh(top, green)
      cap.position.y = 2.4
      cactus.add(cap)
      for (const side of [-1, 1]) {
        const branch = new Mesh(arm, green)
        branch.position.set(side * 0.5, 1.3 + random() * 0.4, 0)
        cactus.add(branch)
        const joint = new Mesh(arm, green)
        joint.scale.set(1, 0.45, 1)
        joint.rotation.z = Math.PI / 2
        joint.position.set(side * 0.28, 1.0 + random() * 0.2, 0)
        cactus.add(joint)
      }
      const scale = 0.8 + random() * 0.8
      cactus.scale.setScalar(scale)
      cactus.position.set(x, 0, z)
      cactus.rotation.y = random() * 6
      cactus.traverse((object) => { object.castShadow = true })
      this.group.add(cactus)
    }
  }
}
