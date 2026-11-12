import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import { BELT } from './sceneConfig.ts'

/** The rubber running belt itself is thin; the frame under it is what gives the deck its depth. */
const BELT_THICKNESS = 0.14
const FRAME_DEPTH = 0.5
const ROLLER_RADIUS = 0.34
/** The non-slip plates either side of the belt, where a runner would plant a foot to step off. */
const SIDE_DECK_WIDTH = 1.1
const SIDE_DECK_THICKNESS = 0.1
/** The side housings the handrails and motor sit in. */
const HOUSING_WIDTH = 0.7
const HOUSING_HEIGHT = 1.05
const DIVIDER_WIDTH = 0.06
const EDGE_LINE_WIDTH = 0.14
/** The steel piers the machine stands on, driven down into the sea. */
const PIER_SPACING = 16
const PIER_DEPTH = 8
/** How deep the motor shroud at the near end reaches. */
const SHROUD_DEPTH = 2.4
const SHROUD_HEIGHT = 0.95

const TILE_PIXELS = 128

/** A texture that tiles, drawn by `paint` onto a square canvas. */
function createTile(paint: (context: CanvasRenderingContext2D) => void, srgb: boolean): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_PIXELS
  canvas.height = TILE_PIXELS
  paint(canvas.getContext('2d')!)
  const texture = new CanvasTexture(canvas)
  if (srgb) texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  return texture
}

/** A fixed, repeatable scatter, so every machine wears the same grit. */
function scatter(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

/**
 * Black rubber belt, seen from above: fine cross-grooves, a speckle of grit,
 * and a faint splice line where the belt is joined.
 */
function paintBelt(context: CanvasRenderingContext2D): void {
  context.fillStyle = '#3a3e47'
  context.fillRect(0, 0, TILE_PIXELS, TILE_PIXELS)
  const random = scatter(5)
  for (let speck = 0; speck < 900; speck++) {
    context.fillStyle = random() > 0.5 ? '#444953' : '#30333b'
    context.fillRect(random() * TILE_PIXELS, random() * TILE_PIXELS, 1 + random() * 2, 1 + random() * 2)
  }
  // Grooves across the belt, every 16px: the ridges a treadmill belt has.
  for (let row = 0; row < TILE_PIXELS; row += 16) {
    context.fillStyle = '#2a2d34'
    context.fillRect(0, row + 6, TILE_PIXELS, 3)
    context.fillStyle = '#4b505b'
    context.fillRect(0, row + 9, TILE_PIXELS, 1)
  }
  // The splice.
  context.fillStyle = '#565c68'
  context.fillRect(0, 0, TILE_PIXELS, 3)
}

/** The same belt as relief: grooves sunk, the splice raised, so the light catches the ridges. */
function paintBeltRelief(context: CanvasRenderingContext2D): void {
  context.fillStyle = '#808080'
  context.fillRect(0, 0, TILE_PIXELS, TILE_PIXELS)
  for (let row = 0; row < TILE_PIXELS; row += 16) {
    context.fillStyle = '#1c1c1c'
    context.fillRect(0, row + 6, TILE_PIXELS, 3)
    context.fillStyle = '#b4b4b4'
    context.fillRect(0, row + 9, TILE_PIXELS, 1)
  }
  context.fillStyle = '#d0d0d0'
  context.fillRect(0, 0, TILE_PIXELS, 3)
}

/** Diamond plate: rows of little raised lozenges, alternately turned. */
function paintDiamondPlate(context: CanvasRenderingContext2D): void {
  context.fillStyle = '#4f545e'
  context.fillRect(0, 0, TILE_PIXELS, TILE_PIXELS)
  const step = TILE_PIXELS / 8
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const tilt = (row + column) % 2 === 0 ? 1 : -1
      const x = column * step + step / 2
      const y = row * step + step / 2
      context.save()
      context.translate(x, y)
      context.rotate((tilt * Math.PI) / 4)
      context.fillStyle = '#7b818d'
      context.fillRect(-step * 0.34, -step * 0.09, step * 0.68, step * 0.18)
      context.restore()
    }
  }
}

/**
 * The giant treadmill every contestant runs on, built like a real one: a black
 * ridged belt rolling over a roller at the near end, non-slip plates down both
 * sides, aluminium housings with rubber capping, and a motor
 * shroud closing off the end. The whole machine stands on steel piers out over
 * the sea.
 *
 * Nothing here moves but the belt's surface and the roller, which is what
 * makes the contestants look like they are running somewhere.
 */
export class Treadmill {
  readonly group = new Group()
  private readonly beltTexture = createTile(paintBelt, true)
  private readonly reliefTexture = createTile(paintBeltRelief, false)
  private readonly plateTexture = createTile(paintDiamondPlate, true)
  private readonly rollerTexture = createTile(paintBelt, true)
  private readonly belt: Mesh
  private readonly roller: Mesh
  private readonly body: Group = new Group()
  private readonly markings: Group = new Group()
  private readonly disposables: { dispose: () => void }[] = []
  private width = 0

  constructor() {
    const length = BELT.NEAR_Z - BELT.FAR_Z
    const centerZ = (BELT.NEAR_Z + BELT.FAR_Z) / 2

    const top = new MeshStandardMaterial({
      map: this.beltTexture,
      bumpMap: this.reliefTexture,
      bumpScale: 1.6,
      roughness: 0.92,
    })
    const rubber = new MeshStandardMaterial({ color: 0x23262c, roughness: 0.95 })
    this.disposables.push(
      top,
      rubber,
      this.beltTexture,
      this.reliefTexture,
      this.plateTexture,
      this.rollerTexture,
    )
    this.beltTexture.repeat.set(1, length / BELT.STRIPE_PITCH)
    this.reliefTexture.repeat.set(1, length / BELT.STRIPE_PITCH)
    // Order: +x, -x, +y (the surface), -y, +z, -z.
    this.belt = new Mesh(new BoxGeometry(1, BELT_THICKNESS, length), [rubber, rubber, top, rubber, rubber, rubber])
    this.belt.position.set(0, -BELT_THICKNESS / 2, centerZ)
    this.belt.receiveShadow = true

    // The belt turns over this at the near end, so it reads as one loop rather than a slab.
    this.rollerTexture.repeat.set(1, 6)
    this.roller = new Mesh(
      new CylinderGeometry(ROLLER_RADIUS, ROLLER_RADIUS, 1, 28),
      new MeshStandardMaterial({ map: this.rollerTexture, roughness: 0.9 }),
    )
    this.roller.rotation.z = Math.PI / 2
    this.roller.position.set(0, -ROLLER_RADIUS, BELT.NEAR_Z)
    this.roller.receiveShadow = true
    this.disposables.push(this.belt.geometry, this.roller.geometry, this.roller.material as MeshStandardMaterial)

    this.group.add(this.belt, this.roller, this.body, this.markings)
  }

  /** Sizes the machine to its lanes and marks a line between each. */
  setLayout(slotXs: readonly number[], width: number): void {
    this.width = width
    this.belt.scale.x = width
    this.roller.scale.y = width
    // The grain stays the same size however wide the belt is.
    this.beltTexture.repeat.x = width / BELT.STRIPE_PITCH
    this.reliefTexture.repeat.x = width / BELT.STRIPE_PITCH
    this.buildBody(width)
    this.buildMarkings(slotXs, width)
  }

  update(deltaSeconds: number): void {
    // The surface rolls toward the camera: the grooves advance toward +Z.
    const advance = (BELT.SPEED / BELT.STRIPE_PITCH) * deltaSeconds
    this.beltTexture.offset.y += advance
    this.reliefTexture.offset.y += advance
    this.roller.rotation.x -= (BELT.SPEED / ROLLER_RADIUS) * deltaSeconds
  }

  get beltWidth(): number {
    return this.width
  }

  dispose(): void {
    this.clear(this.body)
    this.clear(this.markings)
    this.disposables.forEach((item) => { item.dispose() })
  }

  /* ---------------- construction ---------------- */

  private buildBody(width: number): void {
    this.clear(this.body)
    const length = BELT.NEAR_Z - BELT.FAR_Z
    const centerZ = (BELT.NEAR_Z + BELT.FAR_Z) / 2
    const overall = width + 2 * (SIDE_DECK_WIDTH + HOUSING_WIDTH)

    this.plateTexture.repeat.set(SIDE_DECK_WIDTH / 1.2, length / 1.2)
    const plate = new MeshStandardMaterial({ map: this.plateTexture, roughness: 0.6 })
    const aluminium = new MeshStandardMaterial({ color: 0xd5dae2, roughness: 0.38, metalness: 0.25 })
    const cap = new MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.85 })
    const steel = new MeshStandardMaterial({ color: 0x59606b, roughness: 0.55, metalness: 0.3 })
    const pierSteel = new MeshStandardMaterial({ color: 0x7f8895, roughness: 0.6, metalness: 0.25 })
    const warning = new MeshBasicMaterial({ color: 0xffc400 })

    const plateGeometry = new BoxGeometry(SIDE_DECK_WIDTH, SIDE_DECK_THICKNESS, length)
    const housingGeometry = new BoxGeometry(HOUSING_WIDTH, HOUSING_HEIGHT, length)
    const capGeometry = new BoxGeometry(HOUSING_WIDTH - 0.12, 0.07, length)
    const pierGeometry = new CylinderGeometry(0.42, 0.5, PIER_DEPTH, 12)
    const frameGeometry = new BoxGeometry(overall, FRAME_DEPTH, length)
    const shroudGeometry = new BoxGeometry(overall, SHROUD_HEIGHT, SHROUD_DEPTH)
    const shroudCapGeometry = new BoxGeometry(overall - 0.3, 0.07, SHROUD_DEPTH - 0.3)
    const warningGeometry = new BoxGeometry(overall - 0.6, 0.12, 0.12)

    const owned: { dispose: () => void }[] = [
      plate, aluminium, cap, steel, pierSteel, warning,
      plateGeometry, housingGeometry, capGeometry, pierGeometry,
      frameGeometry, shroudGeometry, shroudCapGeometry, warningGeometry,
    ]
    this.body.userData.owned = owned

    // The frame under the belt, which gives the deck its depth when seen from the side.
    const frame = new Mesh(frameGeometry, steel)
    frame.position.set(0, -BELT_THICKNESS - FRAME_DEPTH / 2 + 0.02, centerZ)
    this.body.add(frame)

    const plateTop = SIDE_DECK_THICKNESS - BELT_THICKNESS
    for (const side of [-1, 1]) {
      const plateX = side * (width / 2 + SIDE_DECK_WIDTH / 2)
      const sidePlate = new Mesh(plateGeometry, plate)
      sidePlate.position.set(plateX, plateTop - SIDE_DECK_THICKNESS / 2, centerZ)
      sidePlate.receiveShadow = true

      const housingX = side * (width / 2 + SIDE_DECK_WIDTH + HOUSING_WIDTH / 2)
      const housing = new Mesh(housingGeometry, aluminium)
      housing.position.set(housingX, HOUSING_HEIGHT / 2 - BELT_THICKNESS, centerZ)
      housing.receiveShadow = true
      const housingCap = new Mesh(capGeometry, cap)
      housingCap.position.set(housingX, HOUSING_HEIGHT - BELT_THICKNESS + 0.03, centerZ)
      this.body.add(sidePlate, housing, housingCap)

      for (let z = BELT.NEAR_Z - 4; z > BELT.FAR_Z; z -= PIER_SPACING) {
        const pier = new Mesh(pierGeometry, pierSteel)
        pier.position.set(housingX, -BELT_THICKNESS - FRAME_DEPTH - PIER_DEPTH / 2 + 0.4, z)
        pier.castShadow = true
        this.body.add(pier)
      }
    }

    // The motor shroud closing off the near end, with a hazard strip across its front.
    const shroudZ = BELT.NEAR_Z + ROLLER_RADIUS + SHROUD_DEPTH / 2 - 0.05
    const shroud = new Mesh(shroudGeometry, aluminium)
    shroud.position.set(0, SHROUD_HEIGHT / 2 - BELT_THICKNESS, shroudZ)
    shroud.castShadow = true
    const shroudCap = new Mesh(shroudCapGeometry, cap)
    shroudCap.position.set(0, SHROUD_HEIGHT - BELT_THICKNESS + 0.03, shroudZ)
    const hazard = new Mesh(warningGeometry, warning)
    hazard.position.set(0, 0.22, shroudZ + SHROUD_DEPTH / 2 + 0.01)
    this.body.add(shroud, shroudCap, hazard)
  }

  /** Painted lines: a yellow edge down each side of the belt, and a pale line between lanes. */
  private buildMarkings(slotXs: readonly number[], width: number): void {
    this.clear(this.markings)
    const length = BELT.NEAR_Z - BELT.FAR_Z
    const centerZ = (BELT.NEAR_Z + BELT.FAR_Z) / 2
    const laneLine = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
    const edgeLine = new MeshBasicMaterial({ color: 0xffc400 })
    const laneGeometry = new BoxGeometry(DIVIDER_WIDTH, 0.01, length)
    const edgeGeometry = new BoxGeometry(EDGE_LINE_WIDTH, 0.01, length)
    this.markings.userData.owned = [laneLine, edgeLine, laneGeometry, edgeGeometry]

    for (let index = 1; index < slotXs.length; index++) {
      const line = new Mesh(laneGeometry, laneLine)
      line.position.set((slotXs[index - 1]! + slotXs[index]!) / 2, 0.012, centerZ)
      this.markings.add(line)
    }
    for (const side of [-1, 1]) {
      const edge = new Mesh(edgeGeometry, edgeLine)
      edge.position.set(side * (width / 2 - EDGE_LINE_WIDTH / 2 - 0.05), 0.012, centerZ)
      this.markings.add(edge)
    }
  }

  private clear(group: Group): void {
    group.clear()
    const owned = group.userData.owned as { dispose: () => void }[] | undefined
    owned?.forEach((item) => { item.dispose() })
    group.userData.owned = undefined
  }
}
