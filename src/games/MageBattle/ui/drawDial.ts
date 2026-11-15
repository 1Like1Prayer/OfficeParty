import { blocksOf } from '../../../shared/games/mageBattle/dial.ts'
import type { Dial } from '../../../shared/games/mageBattle/types.ts'

/** The blocks' colours by their points: the big easy one red, the small rich one green. */
export const BLOCK_COLORS: Record<number, string> = { 1: '#E5382F', 2: '#FF7A2E', 3: '#FFC400', 4: '#9CE86A' }

const INK = '#2E2A45'
const NEEDLE = '#E5382F'

/** A flourish on the ring after a press, fading out. */
export interface DialFlash {
  /** The block's colour for a hit, red for a miss. */
  color: string
  /** 1 just pressed, down to 0. */
  strength: number
  isMiss: boolean
}

/** Degrees clockwise from the top, as a canvas angle. */
const toCanvas = (degrees: number): number => ((degrees - 90) * Math.PI) / 180

/**
 * Draws the dial: a stone ring with this spin's blocks on it, the needle, and
 * where they pressed this spin. The middle stays clear, so the clash shows
 * through it.
 */
export function drawDial(
  canvas: HTMLCanvasElement,
  dial: Dial,
  needleDegrees: number,
  /** Where they pressed this spin, or null. */
  pressedDegrees: number | null,
  flash: DialFlash | null,
): void {
  const context = canvas.getContext('2d')
  if (context === null) return
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const cssSize = canvas.clientWidth || 1
  const size = Math.round(cssSize * ratio)
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size
    canvas.height = size
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, cssSize, cssSize)

  const middle = cssSize / 2
  const shake = flash?.isMiss === true ? Math.sin(flash.strength * 40) * flash.strength * 6 : 0
  const outer = middle - 8
  const width = outer * 0.2
  const radius = outer - width / 2
  context.save()
  context.translate(shake, 0)

  // The stone ring, with an inked edge either side.
  context.lineWidth = width
  context.strokeStyle = 'rgba(52, 48, 72, 0.88)'
  context.beginPath()
  context.arc(middle, middle, radius, 0, Math.PI * 2)
  context.stroke()
  context.lineWidth = 2.5
  context.strokeStyle = INK
  for (const edge of [radius - width / 2, radius + width / 2]) {
    context.beginPath()
    context.arc(middle, middle, edge, 0, Math.PI * 2)
    context.stroke()
  }

  // A hit flares the ring in the block's colour.
  if (flash !== null && !flash.isMiss) {
    context.save()
    context.globalAlpha = flash.strength * 0.5
    context.shadowColor = flash.color
    context.shadowBlur = 16 * flash.strength
    context.lineWidth = width * (1 + 0.2 * flash.strength)
    context.strokeStyle = flash.color
    context.beginPath()
    context.arc(middle, middle, radius, 0, Math.PI * 2)
    context.stroke()
    context.restore()
  }

  // This spin's blocks. Once pressed, the ones they did not hit dim.
  for (const block of blocksOf(dial.level)) {
    const isPressed = dial.pressPoints === block.points
    context.globalAlpha = dial.pressPoints === null || isPressed ? 1 : 0.35
    context.lineWidth = width * 0.78
    context.strokeStyle = BLOCK_COLORS[block.points] ?? '#FFFFFF'
    context.beginPath()
    context.arc(middle, middle, radius, toCanvas(dial.zone + block.fromDeg), toCanvas(dial.zone + block.toDeg))
    context.stroke()
  }
  context.globalAlpha = 1

  // Where they pressed this spin: a bright tick across the ring.
  if (pressedDegrees !== null) {
    const tick = toCanvas(pressedDegrees)
    context.lineCap = 'round'
    context.lineWidth = 4
    context.strokeStyle = dial.pressPoints ? '#FFFFFF' : NEEDLE
    context.beginPath()
    context.moveTo(middle + Math.cos(tick) * (radius - width * 0.62), middle + Math.sin(tick) * (radius - width * 0.62))
    context.lineTo(middle + Math.cos(tick) * (radius + width * 0.62), middle + Math.sin(tick) * (radius + width * 0.62))
    context.stroke()
  }

  // The needle, from the middle to the ring, and its hub.
  const angle = toCanvas(needleDegrees)
  const reach = radius + width / 2 - 2
  const from = outer * 0.28
  context.lineCap = 'round'
  context.strokeStyle = INK
  context.lineWidth = 9
  context.beginPath()
  context.moveTo(middle + Math.cos(angle) * from, middle + Math.sin(angle) * from)
  context.lineTo(middle + Math.cos(angle) * reach, middle + Math.sin(angle) * reach)
  context.stroke()
  context.strokeStyle = NEEDLE
  context.lineWidth = 5
  context.stroke()
  context.restore()
}
