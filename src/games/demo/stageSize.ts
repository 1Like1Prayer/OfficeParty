import { fluid } from '../../theme/index.ts'

/**
 * The demo stage's height: it grows with the screen's width like the rest of
 * the theme, but never past a share of the screen's height, so on a wide, short
 * laptop the reveal screen still fits.
 */
export const STAGE_HEIGHT = `max(210px, min(${fluid(210, 340)}, 36vh))`

/**
 * A size inside the demo stage, as a share of the stage's height (`cqh`),
 * clamped. The stage is a size container, so whatever shape the screen gives
 * it, its contents scale with it and never spill out. At the smallest stage
 * the values land close to `minPx`.
 */
export const stageSize = (minPx: number, cqh: number, maxPx: number): string =>
  `clamp(${minPx}px, ${cqh}cqh, ${maxPx}px)`
