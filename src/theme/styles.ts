import type { CSSProperties } from 'react'
import { color, font } from './tokens.ts'

/** Small uppercase label that introduces a section. */
export const eyebrow: CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  letterSpacing: '0.24em',
  color: color.orange,
}

/** Even smaller label used inside panels and cards. */
export const microLabel: CSSProperties = {
  fontWeight: 900,
  fontSize: 11,
  letterSpacing: '0.18em',
  color: color.mutedStrong,
}

export const displayHeading: CSSProperties = {
  fontFamily: font.display,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  lineHeight: 0.95,
}

/** Fills the area beside the scoreboard; every phase screen uses it. */
export const phasePane: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '40px 52px',
}

export const ellipsis: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
