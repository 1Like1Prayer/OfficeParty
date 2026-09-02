/** Design tokens lifted from the Party Arena canvas. */
export const color = {
  cream: '#FFF1D0',
  panel: '#FFFAF0',
  white: '#FFFFFF',
  ink: '#2E2A45',
  red: '#E5382F',
  pink: '#FF5FA2',
  orange: '#FF7A2E',
  yellow: '#FFC400',
  mint: '#3FD9A8',
  mintInk: '#17434A',
  muted: '#6B6486',
  mutedStrong: '#8B84A6',
  mutedSoft: '#A9A2C0',
  dashed: '#C6BFD8',
  leaderBg: '#FFE9A3',
} as const

export const font = {
  display: "Fredoka, sans-serif",
  body: "'Nunito Sans', system-ui, sans-serif",
  mono: 'ui-monospace, monospace',
} as const

export const border = {
  heavy: `4px solid ${color.ink}`,
  medium: `3px solid ${color.ink}`,
  thin: `2px solid ${color.ink}`,
} as const

/** Offset drop shadow used by every raised control. */
export const lift = (depth: number) => `0 ${depth}px 0 ${color.ink}`
