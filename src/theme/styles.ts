import type { CSSProperties } from 'react'
import { border, color, font, lift } from './tokens.ts'

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
  letterSpacing: '0.2em',
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
  animation: 'pa-swoop .45s ease-out',
}

/** The big outlined card the lobby is built from. */
export const bigCard: CSSProperties = {
  background: color.white,
  border: border.heavy,
  borderRadius: 26,
}

/** A small inline action, e.g. "SELECT ALL". */
export const inlineAction: CSSProperties = {
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  padding: 0,
  fontWeight: 900,
  fontSize: 11,
  letterSpacing: '0.14em',
  color: color.red,
}

export const ellipsis: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

/** Shared shape for the chunky raised controls. */
export const raised = (depth: number): CSSProperties => ({
  border: border.heavy,
  boxShadow: lift(depth),
  fontFamily: font.display,
  fontWeight: 700,
  cursor: 'pointer',
})
