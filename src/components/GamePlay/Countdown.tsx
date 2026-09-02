import { color, font } from '../../theme/index.ts'

interface CountdownProps {
  msLeft: number
}

/** The 3, 2, 1 the server schedules before the clock actually runs. */
export function Countdown({ msLeft }: CountdownProps) {
  const seconds = Math.ceil(msLeft / 1000)

  return (
    <div
      // Re-keyed each second so the animation replays on every number.
      key={seconds}
      style={{
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: 150,
        lineHeight: 1,
        color: color.red,
        animation: 'pa-rise .3s ease-out',
      }}
    >
      {seconds > 0 ? seconds : 'GO'}
    </div>
  )
}
