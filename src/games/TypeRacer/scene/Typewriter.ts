import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'

const KEY_ROWS = [10, 10, 9]
const KEY_SPACING = 0.092
const BAR_COUNT = 11
const PAPER_WIDTH = 256
const PAPER_HEIGHT = 330
const PAPER_LINE_HEIGHT = 21
/** Taps of the carriage before it has crossed the page and returns. */
const TAPS_PER_PASS = 26

interface KeyMesh {
  mesh: Mesh
  restY: number
  /** How far down it is pressed, 0 to 1; springs back. */
  pressed: number
}

/** The tiny deterministic scribble each line of "typing" is drawn as. */
const wordWidths = (seed: number): number[] => {
  const widths: number[] = []
  let random = seed
  let total = 0
  while (total < 200) {
    random = (random * 16807) % 2147483647
    const width = 10 + (random % 30)
    widths.push(width)
    total += width + 6
  }
  return widths
}

/**
 * An old-fashioned typewriter. Its origin is the middle of the surface it
 * stands on, the keyboard facing +Z (toward the typist) and the carriage at
 * the back. Every key press sinks a key and swings a type bar; every finished
 * line sends the carriage back with a ding and scrolls the page up.
 */
export class Typewriter {
  readonly group = new Group()
  private readonly keys: KeyMesh[] = []
  private readonly bars: { pivot: Group; swing: number }[] = []
  private readonly carriage = new Group()
  private readonly paperTexture: CanvasTexture
  private readonly paperCanvas = document.createElement('canvas')
  private readonly bell: Mesh
  private readonly disposables: { dispose: () => void }[] = []
  /** Finished lines of the page, newest last, and how much of the next is typed. */
  private lines: { widths: number[]; failed: boolean }[] = []
  private lineProgress = 0
  private carriageX = 0.4
  private carriageGoalX = 0.4
  private pass = 0
  private bellRing = 0
  private jamTime = 0
  private lastDrawnProgress = -1
  private drawnLineCount = -1
  private tapsInLine = 0

  constructor() {
    const body = this.track(new MeshStandardMaterial({ color: 0x253832, roughness: 0.45, metalness: 0.55 }))
    const chrome = this.track(new MeshStandardMaterial({ color: 0xd6dbe0, roughness: 0.2, metalness: 0.95 }))
    const rubber = this.track(new MeshStandardMaterial({ color: 0x15151a, roughness: 0.9 }))

    this.addBox(body, [1.34, 0.14, 0.92], [0, 0.07, 0])
    this.addBox(body, [1.16, 0.14, 0.78], [0, 0.21, -0.06])
    // Chrome trim along the front.
    this.addBox(chrome, [1.34, 0.025, 0.03], [0, 0.145, 0.45])
    this.addBox(chrome, [1.18, 0.02, 0.02], [0, 0.285, -0.44])

    this.buildKeyboard(body, rubber)
    this.buildTypeBars(chrome)
    this.buildCarriage(chrome, rubber)

    // The bell, at the right-hand end.
    this.bell = new Mesh(
      this.track(new SphereGeometry(0.06, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
      chrome,
    )
    this.bell.position.set(0.6, 0.29, 0.1)
    this.group.add(this.bell)

    this.paperCanvas.width = PAPER_WIDTH
    this.paperCanvas.height = PAPER_HEIGHT
    this.paperTexture = new CanvasTexture(this.paperCanvas)
    this.paperTexture.colorSpace = SRGBColorSpace
    this.disposables.push(this.paperTexture)
    this.buildPaper()
    this.drawPaper()
    this.group.traverse((object) => { object.castShadow = true })
  }

  /** Where a hand rests on the keys, in this typewriter's own frame. */
  handRestPoint(side: -1 | 1): Vector3 {
    return new Vector3(side * 0.22, 0.4, 0.2)
  }

  /** A key goes down, and a type bar swings up to strike the page. */
  press(): void {
    const key = this.keys[Math.floor(Math.random() * this.keys.length)]!
    key.pressed = 1
    const bar = this.bars[Math.floor(Math.random() * this.bars.length)]!
    bar.swing = 1

    this.tapsInLine += 1
    this.lineProgress = Math.min(0.98, this.tapsInLine / TAPS_PER_PASS)
    this.carriageGoalX = 0.4 - this.lineProgress * 0.8
  }

  /** A finished line: the carriage swings home with a ding, and the page scrolls up. */
  lineDone(): void {
    this.lines.push({ widths: wordWidths(this.lines.length * 977 + 13), failed: false })
    if (this.lines.length > 14) this.lines.shift()
    this.tapsInLine = 0
    this.lineProgress = 0
    this.carriageGoalX = 0.4
    this.bellRing = 1
    this.pass += 1
  }

  /** A mistake: the type bars tangle and the page gets a red smudge. */
  jam(): void {
    this.jamTime = 0.5
    this.lines.push({ widths: wordWidths(this.lines.length * 311 + 5).slice(0, 3), failed: true })
    if (this.lines.length > 14) this.lines.shift()
    this.tapsInLine = 0
    this.lineProgress = 0
    this.carriageGoalX = 0.4
    for (const bar of this.bars) bar.swing = Math.random()
  }

  /** A fresh sheet, for a new paragraph. */
  newSheet(): void {
    this.lines = []
    this.drawnLineCount = -1
    this.tapsInLine = 0
    this.lineProgress = 0
    this.carriageGoalX = 0.4
  }

  update(deltaSeconds: number): void {
    for (const key of this.keys) {
      key.pressed = Math.max(0, key.pressed - deltaSeconds * 9)
      key.mesh.position.y = key.restY - key.pressed * 0.035
    }
    for (const bar of this.bars) {
      bar.swing = Math.max(0, bar.swing - deltaSeconds * 7)
      // Rests leaning back; swings up and forward to hit the page.
      bar.pivot.rotation.x = -1.15 + Math.sin(Math.min(1, bar.swing) * Math.PI * 0.5) * 1.1
    }

    const home = this.carriageGoalX > this.carriageX
    this.carriageX += (this.carriageGoalX - this.carriageX) * (1 - Math.exp(-(home ? 14 : 30) * deltaSeconds))
    this.carriage.position.x = this.carriageX

    this.bellRing = Math.max(0, this.bellRing - deltaSeconds * 3)
    this.bell.scale.setScalar(1 + this.bellRing * 0.35)
    this.bell.position.y = 0.29 + Math.sin(this.bellRing * 22) * 0.012 * this.bellRing

    if (this.jamTime > 0) {
      this.jamTime -= deltaSeconds
      this.group.position.x = (Math.random() - 0.5) * 0.02 * (this.jamTime / 0.5)
    } else {
      this.group.position.x = 0
    }

    // Redraw the page only when what is on it has changed enough to see.
    const quantized = Math.round(this.lineProgress * 24)
    if (this.drawnLineCount !== this.lines.length || this.lastDrawnProgress !== quantized) {
      this.drawnLineCount = this.lines.length
      this.lastDrawnProgress = quantized
      this.drawPaper()
    }
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof Mesh) (object.geometry as BufferGeometry).dispose()
    })
    this.disposables.forEach((item) => { item.dispose() })
  }

  /* ---------------- construction ---------------- */

  private buildKeyboard(body: Material, rubber: Material): void {
    const deck = new Group()
    deck.position.set(0, 0.3, 0.27)
    deck.rotation.x = 0.28 // Higher toward the back, like a real keyboard.
    this.group.add(deck)

    const plate = new Mesh(this.track(new BoxGeometry(1.16, 0.03, 0.46)), body)
    deck.add(plate)

    const keyGeometry = this.track(new CylinderGeometry(0.042, 0.046, 0.05, 14))
    const capMaterial = this.track(new MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.35 }))
    const materials = [rubber, capMaterial, rubber]

    KEY_ROWS.forEach((count, row) => {
      for (let column = 0; column < count; column++) {
        const key = new Mesh(keyGeometry, materials)
        const x = (column - (count - 1) / 2) * KEY_SPACING
        const restY = 0.035
        key.position.set(x, restY, 0.14 - row * 0.115)
        deck.add(key)
        this.keys.push({ mesh: key, restY, pressed: 0 })
      }
    })
    // The space bar.
    const space = new Mesh(this.track(new BoxGeometry(0.6, 0.04, 0.07)), capMaterial)
    space.position.set(0, 0.03, 0.2)
    deck.add(space)
  }

  private buildTypeBars(chrome: Material): void {
    const basket = new Group()
    basket.position.set(0, 0.33, -0.12)
    this.group.add(basket)
    const barGeometry = this.track(new BoxGeometry(0.014, 0.26, 0.014).translate(0, 0.13, 0))
    const tipGeometry = this.track(new BoxGeometry(0.03, 0.03, 0.02))

    for (let index = 0; index < BAR_COUNT; index++) {
      const spread = (index - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2)
      const pivot = new Group()
      pivot.position.set(spread * 0.2, 0, 0.02 * Math.abs(spread))
      pivot.rotation.y = -spread * 0.35
      const bar = new Mesh(barGeometry, chrome)
      const tip = new Mesh(tipGeometry, chrome)
      tip.position.y = 0.26
      pivot.add(bar, tip)
      basket.add(pivot)
      this.bars.push({ pivot, swing: 0 })
    }
  }

  private buildCarriage(chrome: Material, rubber: Material): void {
    this.carriage.position.set(0.4, 0.46, -0.32)
    this.group.add(this.carriage)

    const rail = new Mesh(this.track(new BoxGeometry(1.3, 0.04, 0.07)), chrome)
    rail.position.y = -0.1
    this.carriage.add(rail)

    const platen = new Mesh(this.track(new CylinderGeometry(0.075, 0.075, 1.1, 20)), rubber)
    platen.rotation.z = Math.PI / 2
    this.carriage.add(platen)
    for (const side of [-1, 1]) {
      const knob = new Mesh(this.track(new CylinderGeometry(0.06, 0.06, 0.08, 16)), chrome)
      knob.rotation.z = Math.PI / 2
      knob.position.x = side * 0.6
      this.carriage.add(knob)
    }
    // The return lever.
    const lever = new Mesh(this.track(new BoxGeometry(0.2, 0.02, 0.02)), chrome)
    lever.position.set(-0.7, 0.04, 0.06)
    this.carriage.add(lever)
  }

  private buildPaper(): void {
    const paperMaterial = this.track(
      new MeshStandardMaterial({ map: this.paperTexture, roughness: 0.95, side: DoubleSide }),
    )
    const paper = new Mesh(this.track(new BoxGeometry(0.78, 0.98, 0.006).translate(0, 0.49, 0)), paperMaterial)
    // It wraps the roller and leans back a little, its face toward the typist.
    paper.position.set(0, 0.03, 0.06)
    paper.rotation.x = -0.1
    // The carriage carries the page with it; the page itself stays put, so it is counter-moved.
    this.group.add(paper)
  }

  private drawPaper(): void {
    const context = this.paperCanvas.getContext('2d')!
    context.fillStyle = '#F6F0DC'
    context.fillRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    context.fillStyle = 'rgba(120, 100, 60, 0.12)'
    for (let edge = 0; edge < 3; edge++) context.fillRect(0, edge * 2, PAPER_WIDTH, 1)

    const bottom = PAPER_HEIGHT - 26
    const drawLine = (widths: number[], row: number, fraction: number, failed: boolean) => {
      const y = bottom - row * PAPER_LINE_HEIGHT
      if (y < 12) return
      context.fillStyle = failed ? 'rgba(200, 40, 30, 0.85)' : 'rgba(30, 28, 40, 0.78)'
      let x = 18
      const limit = 18 + 200 * fraction
      for (const width of widths) {
        if (x + width > limit + 4) break
        context.fillRect(x, y, width, 3.5)
        x += width + 6
      }
    }
    for (let index = this.lines.length - 1; index >= 0; index--) {
      const line = this.lines[index]!
      drawLine(line.widths, this.lines.length - index, 1, line.failed)
    }
    drawLine(wordWidths(this.lines.length * 131 + 3), 0, this.lineProgress, false)
    this.paperTexture.needsUpdate = true
  }

  private addBox(material: Material, [w, h, d]: [number, number, number], [x, y, z]: [number, number, number]): Mesh {
    const mesh = new Mesh(this.track(new BoxGeometry(w, h, d)), material)
    mesh.position.set(x, y, z)
    this.group.add(mesh)
    return mesh
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item)
    return item
  }
}
