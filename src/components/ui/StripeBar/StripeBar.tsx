import { color } from '../../../theme/index.ts'

/** Animated candy stripe pinned to the top of the arena. */
export function StripeBar() {
  return (
    <div
      style={{
        height: 10,
        flexShrink: 0,
        backgroundImage: `repeating-linear-gradient(115deg,${color.pink} 0 28px,${color.yellow} 28px 56px)`,
        animation: 'pa-stripe 1.4s linear infinite',
      }}
    />
  )
}
