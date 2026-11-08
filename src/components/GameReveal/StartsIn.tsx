import { color, font, sharedStyles } from '../../theme/index.ts'

/** Three numbers, however long the room's window is. */
export const START_BEATS = 3

interface StartsInProps {
  /** Beats remaining, from `beatsRemaining`. */
  beats: number
}

/**
 * Everyone is in. The room counts the round in before handing over to it, so
 * the screen does not change under anyone mid-sentence.
 */
export function StartsIn({ beats }: StartsInProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ ...sharedStyles.microLabel, fontSize: 15, letterSpacing: '0.22em' }}>
        GAME BEGINS IN
      </div>
      <div
        // Re-keyed each second so the number pops on every tick.
        key={beats}
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 88,
          lineHeight: 1,
          color: color.red,
          animation: 'pa-pop .5s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        {beats}
      </div>
    </div>
  )
}
