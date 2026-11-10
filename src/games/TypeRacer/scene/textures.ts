import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

/** A canvas to draw a texture on. */
function canvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void,
): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!, width, height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

/** Weathered wood: warm base, long dark grain lines, a few knots. */
export function createWoodTexture(): CanvasTexture {
  return canvasTexture(256, 256, (context, width, height) => {
    const random = seeded(7)
    context.fillStyle = '#9a6a3a'
    context.fillRect(0, 0, width, height)
    for (let line = 0; line < 70; line++) {
      const x = random() * width
      context.strokeStyle = `rgba(${60 + random() * 40}, ${30 + random() * 20}, 10, ${0.12 + random() * 0.22})`
      context.lineWidth = 0.6 + random() * 2.2
      context.beginPath()
      context.moveTo(x, 0)
      context.bezierCurveTo(x + (random() - 0.5) * 24, height * 0.33, x + (random() - 0.5) * 24, height * 0.66, x + (random() - 0.5) * 14, height)
      context.stroke()
    }
    for (let knot = 0; knot < 4; knot++) {
      const x = random() * width
      const y = random() * height
      for (let ring = 4; ring > 0; ring--) {
        context.strokeStyle = `rgba(50, 25, 8, ${0.12 * ring})`
        context.lineWidth = 1.2
        context.beginPath()
        context.ellipse(x, y, 3 + ring * 3, 2 + ring * 5, 0, 0, Math.PI * 2)
        context.stroke()
      }
    }
  })
}

/** Planks side by side, lighter than the block, with dark gaps between them. */
export function createPlankTexture(): CanvasTexture {
  const texture = canvasTexture(256, 256, (context, width, height) => {
    const random = seeded(31)
    const plankCount = 5
    const plankWidth = width / plankCount
    for (let plank = 0; plank < plankCount; plank++) {
      const shade = 150 + random() * 40
      context.fillStyle = `rgb(${shade}, ${shade * 0.72}, ${shade * 0.45})`
      context.fillRect(plank * plankWidth, 0, plankWidth, height)
      for (let grain = 0; grain < 10; grain++) {
        const x = plank * plankWidth + random() * plankWidth
        context.strokeStyle = `rgba(70, 38, 14, ${0.1 + random() * 0.18})`
        context.lineWidth = 0.8 + random() * 1.6
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x + (random() - 0.5) * 6, height)
        context.stroke()
      }
      context.fillStyle = 'rgba(30, 14, 4, 0.7)'
      context.fillRect(plank * plankWidth, 0, 2, height)
    }
  })
  texture.wrapS = texture.wrapT = RepeatWrapping
  return texture
}

/** One face of the die. Hearts sit on warm ivory, skulls on charcoal. */
export function createDieFaceTexture(kind: 'heart' | 'skull'): CanvasTexture {
  return canvasTexture(256, 256, (context, width, height) => {
    const centerX = width / 2
    const centerY = height / 2
    context.fillStyle = kind === 'heart' ? '#FFF1DC' : '#2A2735'
    context.fillRect(0, 0, width, height)
    context.lineWidth = 10
    context.strokeStyle = kind === 'heart' ? '#E5382F' : '#8B84A6'
    context.strokeRect(10, 10, width - 20, height - 20)

    if (kind === 'heart') {
      context.fillStyle = '#E5382F'
      context.beginPath()
      context.moveTo(centerX, centerY + 62)
      context.bezierCurveTo(centerX - 120, centerY - 10, centerX - 50, centerY - 90, centerX, centerY - 28)
      context.bezierCurveTo(centerX + 50, centerY - 90, centerX + 120, centerY - 10, centerX, centerY + 62)
      context.fill()
      context.fillStyle = 'rgba(255,255,255,0.45)'
      context.beginPath()
      context.ellipse(centerX - 36, centerY - 30, 12, 20, -0.6, 0, Math.PI * 2)
      context.fill()
    } else {
      context.fillStyle = '#F4EFE6'
      context.beginPath()
      context.arc(centerX, centerY - 14, 62, 0, Math.PI * 2)
      context.fill()
      context.fillRect(centerX - 36, centerY + 20, 72, 52)
      context.fillStyle = '#2A2735'
      for (const side of [-1, 1]) {
        context.beginPath()
        context.ellipse(centerX + side * 26, centerY - 16, 17, 22, 0, 0, Math.PI * 2)
        context.fill()
      }
      context.beginPath()
      context.moveTo(centerX, centerY + 6)
      context.lineTo(centerX - 8, centerY + 26)
      context.lineTo(centerX + 8, centerY + 26)
      context.fill()
      for (let tooth = -2; tooth <= 2; tooth++) {
        context.fillRect(centerX + tooth * 14 - 3, centerY + 40, 6, 32)
      }
    }
  })
}
