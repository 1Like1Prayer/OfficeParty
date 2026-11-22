/**
 * Bucket fill on the canvas bitmap. A scanline fill: deterministic for the
 * same pixels, so every client that drew the same strokes fills the same
 * area. A little tolerance swallows the anti-aliased edge of a line, which
 * otherwise leaves a pale halo around every filled shape.
 */

/** Largest per-channel difference still counted as the clicked color. */
const TOLERANCE = 48

const hexToRgba = (hex: string): number => {
  const value = parseInt(hex.slice(1), 16)
  const r = (value >> 16) & 0xff
  const g = (value >> 8) & 0xff
  const b = value & 0xff
  // ImageData is RGBA in memory; read as a little-endian u32 that is ABGR.
  return (0xff << 24) | (b << 16) | (g << 8) | r
}

const close = (a: number, b: number): boolean =>
  Math.abs((a & 0xff) - (b & 0xff)) <= TOLERANCE &&
  Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff)) <= TOLERANCE &&
  Math.abs(((a >> 16) & 0xff) - ((b >> 16) & 0xff)) <= TOLERANCE

export function floodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, hex: string): void {
  const { width, height } = ctx.canvas
  const x0 = Math.floor(startX)
  const y0 = Math.floor(startY)
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return

  const image = ctx.getImageData(0, 0, width, height)
  const pixels = new Uint32Array(image.data.buffer)
  const target = pixels[y0 * width + x0]!
  const fill = hexToRgba(hex)
  if (target === fill) return

  const seen = new Uint8Array(width * height)
  const stack: number[] = [x0, y0]
  while (stack.length > 0) {
    const y = stack.pop()!
    let x = stack.pop()!
    // Walk left to the start of this run, then fill rightwards.
    while (x > 0 && !seen[y * width + x - 1] && close(pixels[y * width + x - 1]!, target)) x--
    let spanAbove = false
    let spanBelow = false
    for (; x < width; x++) {
      const at = y * width + x
      if (seen[at] || !close(pixels[at]!, target)) break
      pixels[at] = fill
      seen[at] = 1
      if (y > 0) {
        const above = at - width
        const fits = !seen[above] && close(pixels[above]!, target)
        if (fits && !spanAbove) stack.push(x, y - 1)
        spanAbove = fits
      }
      if (y < height - 1) {
        const below = at + width
        const fits = !seen[below] && close(pixels[below]!, target)
        if (fits && !spanBelow) stack.push(x, y + 1)
        spanBelow = fits
      }
    }
  }
  ctx.putImageData(image, 0, 0)
}
