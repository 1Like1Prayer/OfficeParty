import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'

const WIDTH = 360
const HEIGHT = 130

export interface NameplateContent {
  name: string
  score: number
  status: string
  isYou: boolean
  isFallen: boolean
}

/** A floating name tag that redraws itself only when its text changes. */
export class Nameplate {
  readonly sprite: Sprite
  private readonly canvas = document.createElement('canvas')
  private readonly texture: CanvasTexture
  private drawnKey = ''

  constructor() {
    this.canvas.width = WIDTH
    this.canvas.height = HEIGHT
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.sprite = new Sprite(new SpriteMaterial({
        map: this.texture,
        // Drawn at a fixed size on screen, whatever the tag's depth, so every
        // tag reads the same; and over the scene, so nothing hides it.
        sizeAttenuation: false,
        depthTest: false,
        depthWrite: false,
      }),)
    this.sprite.renderOrder = 10
  }

  /**
   * How wide the tag is drawn, in the units a screen-sized sprite is scaled in:
   * pixels × 2·tan(fov/2) ÷ canvas height. The scene works that out.
   */
  setWidth(width: number): void {
    this.sprite.scale.set(width, (width * HEIGHT) / WIDTH, 1)
  }

  /** 0 hides the tag, 1 shows it fully. */
  setOpacity(opacity: number): void {
    this.sprite.material.opacity = opacity
  }

  update(content: NameplateContent): void {
    const key = JSON.stringify(content)
    if (key === this.drawnKey) return
    this.drawnKey = key

    const context = this.canvas.getContext('2d')!
    context.clearRect(0, 0, WIDTH, HEIGHT)
    context.globalAlpha = content.isFallen ? 0.55 : 1
    context.fillStyle = content.isYou ? '#FFC400' : '#FFFAF0'
    context.strokeStyle = '#2E2A45'
    context.lineWidth = 8
    context.beginPath()
    context.roundRect(6, 6, WIDTH - 12, HEIGHT - 12, 28)
    context.fill()
    context.stroke()

    context.fillStyle = '#2E2A45'
    context.textBaseline = 'middle'
    context.textAlign = 'left'
    context.font = '800 46px sans-serif'
    context.fillText(this.fit(context, content.isYou ? 'You' : content.name, 200), 24, 44)
    context.font = '800 30px sans-serif'
    context.fillStyle = content.isFallen || content.status.startsWith('−') ? '#E5382F' : '#6B6486'
    context.fillText(content.status, 24, 94)

    context.fillStyle = '#2E2A45'
    context.textAlign = 'right'
    context.font = '800 78px sans-serif'
    context.fillText(String(content.score), WIDTH - 28, HEIGHT / 2 + 2)
    this.texture.needsUpdate = true
  }

  dispose(): void {
    this.texture.dispose()
    this.sprite.material.dispose()
  }

  private fit(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    let fitted = text
    while (fitted.length > 1 && context.measureText(fitted).width > maxWidth) {
      fitted = fitted.slice(0, -1)
    }
    return fitted === text ? text : `${fitted}…`
  }
}
