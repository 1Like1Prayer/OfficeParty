import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'

/** The tag's canvas: the score over a name pill, as Log Dodge has its hearts over one. */
const WIDTH = 360
const SCORE_HEIGHT = 84
const GAP = 4
const PILL_HEIGHT = 112
const HEIGHT = SCORE_HEIGHT + GAP + PILL_HEIGHT

/** Height over width, for anything laying tags out on screen. */
export const RUNNER_TAG_ASPECT = HEIGHT / WIDTH

/**
 * Where the sprite is anchored, up from its foot, as a share of its height:
 * the middle of the pill, so the pill sits where a plain tag would and the
 * score rides above it rather than pushing it down onto the runner.
 */
const PILL_ANCHOR = PILL_HEIGHT / 2 / HEIGHT

const PILL_INSET = 6
const PILL_PADDING = 22
const NAME_MAX_PX = 84
const NAME_MIN_PX = 34
const FONT = (px: number) => `800 ${px}px sans-serif`
const INK = '#2E2A45'
const SCORE_COLOR = '#FFFAF0'

export interface RunnerTagContent {
  name: string
  score: number
  isYou: boolean
}

/**
 * Crusher Escalator's floating name tag: the runner's score above, and their
 * name filling the pill below. It says nothing about who is ahead — where the
 * runners stand on their escalators shows that. Redraws only when it changes.
 */
export class RunnerTag {
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
      // A fixed size on screen whatever its depth, and over the scene, so
      // every tag reads the same and nothing hides it.
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
    }))
    this.sprite.center.set(0.5, PILL_ANCHOR)
    this.sprite.renderOrder = 10
  }

  /** How wide the tag is drawn, in screen-sized sprite units (see `labelWidthFor`). */
  setWidth(width: number): void {
    this.sprite.scale.set(width, width * RUNNER_TAG_ASPECT, 1)
  }

  /** 0 hides the tag, 1 shows it fully. */
  setOpacity(opacity: number): void {
    this.sprite.material.opacity = opacity
  }

  update(content: RunnerTagContent): void {
    const key = JSON.stringify(content)
    if (key === this.drawnKey) return
    this.drawnKey = key

    const context = this.canvas.getContext('2d')!
    context.clearRect(0, 0, WIDTH, HEIGHT)
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineJoin = 'round'

    // The score, outlined so it reads against the stars and the escalators.
    context.font = FONT(76)
    context.lineWidth = 12
    context.strokeStyle = INK
    context.fillStyle = SCORE_COLOR
    context.strokeText(String(content.score), WIDTH / 2, SCORE_HEIGHT / 2 + 4)
    context.fillText(String(content.score), WIDTH / 2, SCORE_HEIGHT / 2 + 4)

    const pillTop = SCORE_HEIGHT + GAP
    context.fillStyle = content.isYou ? '#FFC400' : '#FFFAF0'
    context.lineWidth = 8
    context.beginPath()
    context.roundRect(PILL_INSET, pillTop + PILL_INSET, WIDTH - PILL_INSET * 2, PILL_HEIGHT - PILL_INSET * 2, 28)
    context.fill()
    context.stroke()

    // The name as big as the pill allows, and only cut short once even the smallest size will not fit.
    const name = content.isYou ? 'You' : content.name
    const room = WIDTH - (PILL_INSET + PILL_PADDING) * 2
    context.font = FONT(fitSize(context, name, room))
    context.fillStyle = INK
    context.fillText(truncate(context, name, room), WIDTH / 2, pillTop + PILL_HEIGHT / 2 + 3)

    this.texture.needsUpdate = true
  }

  dispose(): void {
    this.texture.dispose()
    this.sprite.material.dispose()
  }
}

/** The largest font size, in whole pixels, at which `text` fits `room`. */
function fitSize(context: CanvasRenderingContext2D, text: string, room: number): number {
  context.font = FONT(100)
  const widthAt100 = context.measureText(text).width
  if (widthAt100 === 0) return NAME_MAX_PX
  return Math.max(NAME_MIN_PX, Math.min(NAME_MAX_PX, Math.floor((room / widthAt100) * 100)))
}

function truncate(context: CanvasRenderingContext2D, text: string, room: number): string {
  if (context.measureText(text).width <= room) return text
  let fitted = text
  while (fitted.length > 1 && context.measureText(`${fitted}…`).width > room) fitted = fitted.slice(0, -1)
  return `${fitted}…`
}
