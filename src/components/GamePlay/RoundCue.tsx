import { color, fluid, font, sharedStyles } from '../../theme/index.ts'
import { CUES } from './cue.ts'

interface RoundCueProps {
  /** Beats remaining, from `cueFrom`. */
  beats: number
}

/** Get ready, set, start — the last thing before the clock runs. */
export function RoundCue({ beats }: RoundCueProps) {
  const label = CUES[beats - 1] ?? CUES[0]
  const last = beats === 1

  return (
    <div
      // Re-keyed per beat so each word lands rather than cross-fading.
      key={label}
      style={{
        ...sharedStyles.displayHeading,
        fontFamily: font.display,
        fontSize: last ? fluid(56, 92) : fluid(40, 68),
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
        color: last ? color.red : color.ink,
        animation: 'pa-pop .55s cubic-bezier(.34,1.56,.64,1)',
      }}
    >
      {label}
    </div>
  )
}
