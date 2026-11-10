import { CanvasTexture, SRGBColorSpace } from 'three'
import { avatarUrl } from '../../content/avatars.ts'

const SIZE = 128

/**
 * A round badge for a runner's back: their colour and initial straight away,
 * with their avatar drawn over it once (and if) it loads. DiceBear is a
 * third-party service, so a failed load just leaves the initial showing.
 */
export function createAvatarTexture({
  initial,
  color,
  seed,
}: {
  initial: string
  color: string
  seed: string
}): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')!
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace

  context.fillStyle = color
  context.fillRect(0, 0, SIZE, SIZE)
  context.fillStyle = '#2E2A45'
  context.font = `900 ${SIZE * 0.6}px sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(initial, SIZE / 2, SIZE / 2 + SIZE * 0.04)

  if (seed) {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      context.fillStyle = color
      context.fillRect(0, 0, SIZE, SIZE)
      context.drawImage(image, 0, 0, SIZE, SIZE)
      texture.needsUpdate = true
    }
    image.src = avatarUrl(seed, SIZE)
  }
  return texture
}
