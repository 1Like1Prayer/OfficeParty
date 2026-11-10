import { TYPE_RACER } from '../../../shared/games/typeRacer/constants.ts'
import type { Paragraph } from '../../../shared/games/typeRacer/types.ts'
import { border, color, font } from '../../../theme/index.ts'
import type { RaceState } from '../typing/raceState.ts'

interface TypingPanelProps {
  paragraphs: readonly Paragraph[]
  state: RaceState
  /** Whole seconds left on this paragraph, or null before the race starts. */
  secondsLeft: number | null
  isRacing: boolean
  /**
   * How far through the pause between paragraphs, 0 to 1, or null when there
   * is no pause. During it the finished text clears away and a loading bar
   * fills; typing is closed.
   */
  breakProgress: number | null
}

const TYPEWRITER = "'Courier Prime', 'Courier New', ui-monospace, monospace"

const formatClock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** Three pips, filling red as the strikes pile up. */
function Strikes({ strikes }: { strikes: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} aria-label={`${strikes} strikes`}>
      <span style={{ fontWeight: 900, fontSize: 11, letterSpacing: '0.18em', color: color.mutedStrong }}>
        STRIKES
      </span>
      {Array.from({ length: TYPE_RACER.STRIKES_TO_ROLL }, (_, index) => (
        <span
          key={index}
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: border.thin,
            background: index < strikes ? color.red : color.white,
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            fontWeight: 900,
            color: color.white,
            transition: 'background 150ms',
          }}
        >
          {index < strikes ? '✕' : ''}
        </span>
      ))}
    </div>
  )
}

/**
 * The pause between paragraphs, drawn on the paper once the old text has gone:
 * what was just finished, a loading bar filling toward the next paragraph, and
 * how long is left. It fades in as the last line clears.
 */
function BreakLoader({
  progress,
  finished,
  total,
  delayMs,
}: {
  progress: number
  /** How many paragraphs are done; the next is the one after. */
  finished: number
  total: number
  delayMs: number
}) {
  const pauseMs = TYPE_RACER.PARAGRAPH_PAUSE_MS
  const secondsLeft = Math.ceil((1 - progress) * (pauseMs / 1000))
  // The bar only appears once the old text has cleared, so it fills from empty
  // to full across the time it is actually there, and is full as the pause ends.
  const shown = Math.min(1, Math.max(0, (progress * pauseMs - delayMs) / (pauseMs - delayMs)))
  return (
    <div
      style={{
        gridArea: '1 / 1',
        placeSelf: 'center',
        width: 'min(440px, 82%)',
        textAlign: 'center',
        fontFamily: font.display,
        animation: `pa-fade-up 500ms ease-out ${delayMs}ms both`,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.2em', color: color.mintInk }}>
        ✓ PARAGRAPH {finished} DONE
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shown * 100)}
        style={{
          margin: '12px 0 10px',
          height: 16,
          borderRadius: 16,
          border: border.medium,
          background: color.white,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${shown * 100}%`,
            height: '100%',
            backgroundColor: color.mint,
            backgroundImage:
              'linear-gradient(135deg, rgba(255,255,255,.38) 25%, transparent 25% 50%, rgba(255,255,255,.38) 50% 75%, transparent 75%)',
            backgroundSize: '28px 28px',
            animation: 'pa-load-shimmer 700ms linear infinite',
          }}
        />
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.12em', color: color.muted }}>
        NEXT UP · PARAGRAPH {finished + 1} OF {total} · {secondsLeft}s
      </div>
    </div>
  )
}

/**
 * The text to type, on a sheet of paper. The line being typed is the
 * focus: what is right so far is inked, the next key is marked, the rest waits.
 * Lines already done fade; a wrong key flashes the sheet red as the line
 * starts over.
 */
export function TypingPanel({ paragraphs, state, secondsLeft, isRacing, breakProgress }: TypingPanelProps) {
  const paragraph = paragraphs[Math.min(state.paragraphIndex, paragraphs.length - 1)] ?? []
  const isDone = state.status === 'finished' || state.status === 'survived' || state.status === 'out'
  const isRolling = state.status === 'rolling'
  const isLowOnTime = secondsLeft !== null && secondsLeft <= 20
  const isBreak = breakProgress !== null
  /** The paragraph that has just been finished, while it is being cleared away. */
  const finishedParagraph = isBreak ? (paragraphs[state.paragraphIndex - 1] ?? []) : []

  return (
    <div
      style={{
        background: '#FBF6E4',
        border: border.heavy,
        borderRadius: 16,
        boxShadow: `0 6px 0 ${color.ink}`,
        overflow: 'hidden',
        fontFamily: TYPEWRITER,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          padding: '8px 16px',
          background: color.yellowSoft,
          borderBottom: border.thin,
          fontFamily: font.body,
        }}
      >
        <span style={{ fontWeight: 900, fontSize: 12, letterSpacing: '0.18em', color: color.ink }}>
          PARAGRAPH {Math.min(state.paragraphIndex + 1, paragraphs.length)} / {paragraphs.length}
        </span>
        <Strikes strikes={state.strikes} />
        <span
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 20,
            minWidth: 56,
            textAlign: 'right',
            color: isLowOnTime ? color.red : color.ink,
            animation: isLowOnTime ? 'pa-pulse 1s ease-in-out infinite' : undefined,
          }}
        >
          {secondsLeft === null ? '–:––' : formatClock(secondsLeft)}
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          display: 'grid',
          padding: '14px 22px 16px',
          fontSize: 'clamp(15px, 1.7vw, 24px)',
          lineHeight: 1.65,
          // A wrong key restarts this by switching between two identical animations.
          animation:
            state.mistakeCount > 0
              ? `${state.mistakeCount % 2 === 0 ? 'pa-type-mistake' : 'pa-type-mistake-b'} 500ms ease-out`
              : undefined,
          opacity: isRolling || isDone ? 0.45 : 1,
          transition: 'opacity 250ms',
        }}
      >
        {/* Always takes up the room the next paragraph needs, so nothing jumps when it arrives. */}
        <div style={{ gridArea: '1 / 1', visibility: 'hidden' }} aria-hidden>
          {paragraph.map((line, lineIndex) => (
            <div key={lineIndex} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingLeft: 14, fontWeight: 700 }}>
              {line}
            </div>
          ))}
        </div>

        {isBreak ? (
          <>
            {/* The finished paragraph, cleared away one line at a time. */}
            <div style={{ gridArea: '1 / 1' }} aria-hidden>
              {finishedParagraph.map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    paddingLeft: 14,
                    color: color.mintInk,
                    opacity: 0.55,
                    animation: `pa-line-clear 520ms cubic-bezier(.65,0,.35,1) ${lineIndex * 150}ms both`,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
            <BreakLoader
              progress={breakProgress}
              finished={state.paragraphIndex}
              total={paragraphs.length}
              delayMs={finishedParagraph.length * 150 + 450}
            />
          </>
        ) : (
          <div style={{ gridArea: '1 / 1' }}>
            {paragraph.map((line, lineIndex) => {
              const isCurrent = lineIndex === state.lineIndex && !isDone
              const isPast = lineIndex < state.lineIndex || (isDone && state.status === 'finished')
              const typed = isCurrent ? state.typedInLine : isPast ? line.length : 0
              return (
                <div
                  key={lineIndex}
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: isPast ? color.mintInk : color.ink,
                    opacity: isPast ? 0.55 : isCurrent ? 1 : 0.72,
                    fontWeight: isCurrent ? 700 : 500,
                    borderLeft: `4px solid ${isCurrent ? color.red : 'transparent'}`,
                    paddingLeft: 10,
                    // The paragraph is written in a line at a time as it appears.
                    animation: `pa-line-in 420ms ease-out ${lineIndex * 110}ms both`,
                  }}
                >
                  <span style={{ color: color.mintInk }}>{line.slice(0, typed)}</span>
                  {isCurrent && isRacing && !isRolling && typed < line.length && (
                    <span
                      style={{
                        background: color.yellow,
                        boxShadow: `0 2px 0 ${color.ink}`,
                        borderRadius: 3,
                        animation: 'pa-pulse 1s ease-in-out infinite',
                      }}
                    >
                      {line[typed] === ' ' ? ' ' : line[typed]}
                    </span>
                  )}
                  <span style={{ color: isCurrent ? color.ink : undefined }}>
                    {line.slice(isCurrent && isRacing && !isRolling ? typed + 1 : typed)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {(isRolling || isDone) && (
        <div
          style={{
            padding: '8px 16px',
            textAlign: 'center',
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 20,
            background: state.status === 'out' ? color.red : isRolling ? color.yellow : color.mint,
            color: state.status === 'out' ? color.white : color.ink,
            borderTop: border.thin,
          }}
        >
          {isRolling && 'THREE STRIKES — ROLLING THE DICE…'}
          {state.status === 'finished' && 'DONE! Waiting for the others…'}
          {state.status === 'survived' && 'LAST ONE STANDING — you win!'}
          {state.status === 'out' &&
            (state.cause === 'time'
              ? 'TIME’S UP — the block gave way!'
              : 'A SKULL — the block crumbles!')}
        </div>
      )}
    </div>
  )
}
