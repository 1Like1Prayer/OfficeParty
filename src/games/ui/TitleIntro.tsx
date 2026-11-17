import type { CSSProperties } from 'react'
import { color, fluid, font } from '../../theme/index.ts'
import { TITLE_EXIT_MS, type TitleIntroStage } from './useTitleIntro.ts'

/**
 * The first letter waits for the screen change to clear (ScreenTransition's
 * stripes take about a second) and the game to fade in, so it is seen landing.
 */
const START_DELAY_MS = 800
/** Each letter drops in this long after the one before. */
const LETTER_STAGGER_MS = 65
const LETTER_COLORS = [color.red, color.orange, color.yellow, color.mint, color.pink] as const

interface TitleIntroProps {
  title: string
  /** One short line under the title. */
  tagline: string
  /** The little character above the title. */
  prop: 'stopwatch' | 'cubes'
  stage: TitleIntroStage
}

/**
 * The game's name, centred over its screen while the round builds up: the
 * letters drop in one by one and land with a squash, a little prop bounces
 * above them, and it all pops away before the game needs the screen.
 * Decoration only: it never takes a click.
 */
export function TitleIntro({ title, tagline, prop, stage }: TitleIntroProps) {
  if (stage === 'gone') return null
  // Words stay whole: a line may break between them, never inside one.
  const words = title.split(' ').reduce<{ text: string; first: number }[]>((all, text) => {
    const previous = all.at(-1)
    return [...all, { text, first: previous === undefined ? 0 : previous.first + previous.text.length + 1 }]
  }, [])
  const lettersDoneMs = START_DELAY_MS + title.length * LETTER_STAGGER_MS + 500

  return (
    <div
      aria-label={title}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: fluid(10, 16),
        pointerEvents: 'none',
        zIndex: 5,
        animation: stage === 'leaving' ? `pa-title-exit ${TITLE_EXIT_MS}ms cubic-bezier(.5,0,.75,0) both` : undefined,
      }}
    >
      <div aria-hidden style={{ height: fluid(64, 96), display: 'flex', alignItems: 'flex-end' }}>
        {prop === 'stopwatch' ? <Stopwatch /> : <Cubes />}
      </div>

      <div
        aria-hidden
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: '0.32em',
          // Free of the game's own column: as wide as the screen allows.
          width: 'max-content',
          maxWidth: '92vw',
          fontFamily: font.display,
          fontWeight: 700,
          // Sized so a two-word title fits one line on a laptop and wraps between words on a phone.
          fontSize: `min(${fluid(48, 104)}, 9vw)`,
          lineHeight: 1.05,
          letterSpacing: '0.01em',
        }}
      >
        {words.map(({ text, first }) => (
          <span key={first} style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}>
            {[...text].map((letter, offset) => (
              <Letter key={offset} letter={letter} index={first + offset} />
            ))}
          </span>
        ))}
      </div>

      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: fluid(16, 22),
          color: color.mutedStrong,
          animation: `pa-title-tagline .5s ease-out ${lettersDoneMs}ms both`,
        }}
      >
        {tagline}
      </div>
    </div>
  )
}

/** One letter: drops in (outer), then wobbles for as long as it is up (inner). */
function Letter({ letter, index }: { letter: string; index: number }) {
  // Each its own lean, so the word looks hand-placed rather than typeset.
  const tilt = ((index * 37) % 11) - 5
  const outer: CSSProperties & Record<'--tilt', string> = {
    display: 'inline-block',
    '--tilt': `${tilt * 1.4}deg`,
    animation: `pa-title-drop .7s cubic-bezier(.34,1.56,.64,1) ${START_DELAY_MS + index * LETTER_STAGGER_MS}ms both`,
  }
  return (
    <span style={outer}>
      <span
        style={{
          display: 'inline-block',
          color: LETTER_COLORS[index % LETTER_COLORS.length],
          WebkitTextStroke: `0.09em ${color.ink}`,
          paintOrder: 'stroke fill',
          textShadow: `0 0.07em 0 ${color.ink}`,
          animation: `pa-title-wobble 1.4s ease-in-out ${START_DELAY_MS + 700 + index * 90}ms infinite`,
        }}
      >
        {letter}
      </span>
    </span>
  )
}

/** A stopwatch on a swing, its hand racing round. */
function Stopwatch() {
  return (
    <div style={{ transformOrigin: '50% 0%', animation: 'pa-title-swing .9s ease-in-out infinite alternate' }}>
      <svg width="78" height="90" viewBox="0 0 78 90" style={{ display: 'block', overflow: 'visible' }}>
        <rect x="31" y="2" width="16" height="10" rx="3" fill={color.red} stroke={color.ink} strokeWidth="3" />
        <rect x="60" y="18" width="10" height="8" rx="2" fill={color.yellow} stroke={color.ink} strokeWidth="3" transform="rotate(40 65 22)" />
        <circle cx="39" cy="52" r="34" fill={color.ink} />
        <circle cx="39" cy="50" r="31" fill={color.cream} stroke={color.ink} strokeWidth="4" />
        {[0, 90, 180, 270].map((angle) => (
          <line key={angle} x1="39" y1="24" x2="39" y2="30" stroke={color.ink} strokeWidth="3" strokeLinecap="round" transform={`rotate(${angle} 39 50)`} />
        ))}
        <g style={{ transformOrigin: '39px 50px', animation: 'pa-title-hand .8s linear infinite' }}>
          <line x1="39" y1="50" x2="39" y2="28" stroke={color.red} strokeWidth="4" strokeLinecap="round" />
        </g>
        <circle cx="39" cy="50" r="4" fill={color.ink} />
      </svg>
    </div>
  )
}

/** Three blocks hopping in turn, like they are trying to be counted. */
function Cubes() {
  const faces = [
    { top: '#FFE9A3', left: color.yellow, right: '#FF9E4F' },
    { top: '#C9F5E6', left: color.mint, right: '#2BB08A' },
    { top: '#FFD3E6', left: color.pink, right: '#E0418A' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      {faces.map((face, index) => (
        <div
          key={index}
          style={{ transformOrigin: '50% 100%', animation: `pa-title-hop 1.5s ease-in-out ${index * 0.18}s infinite` }}
        >
          <svg width="52" height="58" viewBox="0 0 52 58" style={{ display: 'block' }}>
            <g stroke={color.ink} strokeWidth="3" strokeLinejoin="round">
              <path d="M26 3 L49 15 L26 27 L3 15 Z" fill={face.top} />
              <path d="M3 15 L26 27 L26 55 L3 43 Z" fill={face.left} />
              <path d="M49 15 L26 27 L26 55 L49 43 Z" fill={face.right} />
            </g>
          </svg>
        </div>
      ))}
    </div>
  )
}
