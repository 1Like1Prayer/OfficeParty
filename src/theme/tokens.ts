/** Design tokens lifted from the Party Arena canvas. */
export const color = {
  cream: '#FFF1D0',
  panel: '#FFFAF0',
  white: '#FFFFFF',
  ink: '#2E2A45',
  red: '#E5382F',
  pink: '#FF5FA2',
  pinkSoft: '#FFC7DE',
  orange: '#FF7A2E',
  yellow: '#FFC400',
  yellowSoft: '#FFE9A3',
  /** The dot in the lobby's and title's pegboard backgrounds. */
  dot: '#FFD98A',
  green: '#9CE86A',
  mint: '#3FD9A8',
  mintInk: '#17434A',
  muted: '#6B6486',
  mutedStrong: '#8B84A6',
  mutedSoft: '#A9A2C0',
  dashed: '#C6BFD8',
  leaderBg: '#FFE9A3',
} as const

/** Player swatches, in the order the canvas assigns them. */
export const swatches = [
  '#FFC400',
  '#FF9E4F',
  '#6FD0FF',
  '#9CE86A',
  '#FF8FC4',
  '#C4A8FF',
  '#FFE066',
  '#5FE3C0',
] as const

export const font = {
  display: 'Fredoka, sans-serif',
  body: "'Nunito Sans', system-ui, sans-serif",
  mono: 'ui-monospace, monospace',
} as const

export const border = {
  heavy: `4px solid ${color.ink}`,
  medium: `3px solid ${color.ink}`,
  thin: `2px solid ${color.ink}`,
} as const

/** Offset drop shadow used by every raised control and card. */
export const lift = (depth: number) => `0 ${depth}px 0 ${color.ink}`

/** The pegboard dots behind the title and lobby panels. */
export const pegboard = (dotColor: string = color.dot, size = 46) => ({
  backgroundImage: `radial-gradient(${dotColor} 3px, transparent 3px)`,
  backgroundSize: `${size}px ${size}px`,
})
