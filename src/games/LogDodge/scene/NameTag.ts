import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { LOG_DODGE } from '../../../shared/games/logDodge/constants.ts'

/** The tag's canvas: a row of hearts over a name pill. */
const WIDTH = 360
const HEARTS_HEIGHT = 64
const GAP = 6
const PILL_HEIGHT = 120
const HEIGHT = HEARTS_HEIGHT + GAP + PILL_HEIGHT

/** Width over height, for anything laying tags out on screen. */
export const NAME_TAG_ASPECT = HEIGHT / WIDTH

/**
 * The height of the plain name pill the shared tag used to be, as a share of
 * the width. The sprite is anchored so its pill sits where that tag did, and
 * the hearts stack above it rather than pushing it down onto the contestant.
 */
const PILL_ANCHOR = PILL_HEIGHT / 2 / HEIGHT

const PILL_INSET = 6
const PILL_PADDING = 22
const NAME_MAX_PX = 88
const NAME_MIN_PX = 34
const FONT = (px: number) => `800 ${px}px sans-serif`

const INK = '#2E2A45'
const HEART_ON = '#FF5FA2'
const HEART_OFF = '#4A3F78'

export interface NameTagContent {
  name: string
  lives: number
  isYou: boolean
  isOut: boolean
}

/**
 * Log Dodge's floating name tag: the player's lives as hearts above, and their
 * name filling the pill below. Redraws only when what it shows changes.
 */
export class NameTag {
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
    this.sprite.scale.set(width, width * NAME_TAG_ASPECT, 1)
  }

  /** 0 hides the tag, 1 shows it fully. */
  setOpacity(opacity: number): void {
    this.sprite.material.opacity = opacity
  }

  update(content: NameTagContent): void {
    const key = JSON.stringify(content)
    if (key === this.drawnKey) return
    this.drawnKey = key

    const context = this.canvas.getContext('2d')!
    context.clearRect(0, 0, WIDTH, HEIGHT)
    context.textBaseline = 'middle'
    context.textAlign = 'center'

    this.drawHearts(context, content)

    // The pill, faded once the player is out.
    const pillTop = HEARTS_HEIGHT + GAP
    context.globalAlpha = content.isOut ? 0.55 : 1
    context.fillStyle = content.isYou ? '#FFC400' : '#FFFAF0'
    context.strokeStyle = INK
    context.lineWidth = 8
    context.beginPath()
    context.roundRect(PILL_INSET, pillTop + PILL_INSET, WIDTH - PILL_INSET * 2, PILL_HEIGHT - PILL_INSET * 2, 30)
    context.fill()
    context.stroke()

    // The name as big as the pill allows: the largest size that fits its
    // width, and only cut short once even the smallest size will not fit.
    const name = content.isYou ? 'You' : content.name
    const room = WIDTH - (PILL_INSET + PILL_PADDING) * 2
    const size = fitSize(context, name, room)
    context.font = FONT(size)
    context.fillStyle = INK
    context.fillText(truncate(context, name, room), WIDTH / 2, pillTop + PILL_HEIGHT / 2 + 3)
    context.globalAlpha = 1

    this.texture.needsUpdate = true
  }

  dispose(): void {
    this.texture.dispose()
    this.sprite.material.dispose()
  }

  private drawHearts(context: CanvasRenderingContext2D, { lives, isOut }: NameTagContent): void {
    const centreY = HEARTS_HEIGHT / 2 + 2
    if (isOut) {
      context.font = FONT(44)
      context.lineWidth = 8
      context.strokeStyle = INK
      context.fillStyle = '#FF7A72'
      context.strokeText('OUT', WIDTH / 2, centreY)
      context.fillText('OUT', WIDTH / 2, centreY)
      return
    }

    const total = LOG_DODGE.MAX_HITS
    const spacing = 62
    context.font = FONT(56)
    context.lineWidth = 7
    context.lineJoin = 'round'
    context.strokeStyle = INK
    for (let index = 0; index < total; index++) {
      const x = WIDTH / 2 + (index - (total - 1) / 2) * spacing
      context.fillStyle = index < lives ? HEART_ON : HEART_OFF
      context.strokeText('♥', x, centreY)
      context.fillText('♥', x, centreY)
    }
  }
}

/** The largest font size, in whole pixels, at which `text` fits `room`. */
function fitSize(context: CanvasRenderingContext2D, text: string, room: number): number {
  context.font = FONT(100)
  const widthAt100 = context.measureText(text).width
  if (widthAt100 === 0) return NAME_MAX_PX
  const size = Math.floor((room / widthAt100) * 100)
  return Math.max(NAME_MIN_PX, Math.min(NAME_MAX_PX, size))
}

function truncate(context: CanvasRenderingContext2D, text: string, room: number): string {
  if (context.measureText(text).width <= room) return text
  let fitted = text
  while (fitted.length > 1 && context.measureText(`${fitted}…`).width > room) fitted = fitted.slice(0, -1)
  return `${fitted}…`
}
