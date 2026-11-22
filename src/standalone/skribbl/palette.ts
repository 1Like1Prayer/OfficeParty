/**
 * The drawing palette. Colors travel as indexes into this list (the server
 * only checks they are below CANVAS.PALETTE_SIZE), so every client must have
 * the same list in the same order. Two rows: light shades, then dark.
 */

import { CANVAS } from '../../shared/standalone/skribbl/constants.ts'

export const PALETTE = [
  // Light row
  '#FFFFFF', '#C1C1C1', '#EF130B', '#FF7100', '#FFE400', '#00CC00', '#00FF91',
  '#00B2FF', '#231FD3', '#A300BA', '#DF69A7', '#FFAC8E', '#A0522D',
  // Dark row
  '#000000', '#505050', '#740B07', '#C23800', '#E8A200', '#004619', '#00785D',
  '#00569E', '#0E0865', '#550069', '#873554', '#CC774D', '#63300D',
] as const satisfies readonly string[] & { length: typeof CANVAS.PALETTE_SIZE }

/** The eraser paints the background. */
export const BACKGROUND_COLOR = 0
export const DEFAULT_COLOR = 13

/**
 * Line widths in canvas pixels, by size index. The toolbar offers the first
 * four; the fifth exists because the wire format allows it.
 */
export const BRUSH_WIDTHS = [4, 10, 20, 36, 56] as const satisfies readonly number[] & {
  length: typeof CANVAS.BRUSH_SIZES
}
export const TOOLBAR_SIZES = [0, 1, 2, 3] as const
export const DEFAULT_SIZE = 1

export const colorOf = (index: number): string => PALETTE[index] ?? PALETTE[DEFAULT_COLOR]
export const widthOf = (size: number): number => BRUSH_WIDTHS[size] ?? BRUSH_WIDTHS[DEFAULT_SIZE]
