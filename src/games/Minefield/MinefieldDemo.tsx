import type { CSSProperties } from 'react'
import { MINEFIELD } from '../../shared/games/minefield/constants.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import { DemoCard, DemoRow } from '../demo/DemoKit.tsx'
import { stepAt, useLoopTime } from '../demo/demoLoop.ts'
import { stageSize } from '../demo/stageSize.ts'

/**
 * The race, played on a loop in miniature and seen from above: the runner sets
 * off for the finish, walks onto a hidden mine and loses a heart, sends a
 * sonar pulse that shows the mines ahead, and threads between them to cross
 * the line first. It stands in for the written rules on the reveal screen.
 *
 * Every frame is derived from the time into the loop, so it never drifts and
 * can be dropped in or out of the page at any moment.
 */

/** Timeline, in ms into the loop. */
const BLAST_STEP_AT = 2_800
const SONAR_STEP_AT = 6_000
const STANDINGS_AT = 11_000
const LOOP_MS = 14_400

const BLAST_AT = 4_300
/** Blinking after a blast, while another cannot hurt. */
const PROTECTED_MS = 1_300
const SONAR_AT = 6_500
const SONAR_MS = 900
/** The runner stands still while the sonar scans. */
const SCAN_HOLD_MS = 1_100
const FINISH_AT = 10_300

const STEPS = ['Race to the line', 'Mines are hidden', 'Sonar shows them', 'First across wins'] as const

/*
 * The scene's own units. The SVG is fitted to the stage's height, so these map
 * to the same share of the stage at every size; the sand runs far past the
 * sides so a wide stage is filled edge to edge.
 */
const VIEW_W = 280
const VIEW_H = 200
const FAR = 2_000
const START_X = 22
const FINISH_X = 250
const TRIGGER_RADIUS = 14
const SONAR_RADIUS = 78

const SAND = '#E9CF8F'
const SAND_DARK = '#D8B872'
const MINE = '#2E2A45'
const DANGER = '#E5382F'
const SONAR = '#3fb8e0'
const RUNNER = '#FFC400'
/** The runner is drawn larger than the field's scale, so it reads at a glance. */
const RUNNER_SCALE = 1.7
const SKIN = '#FFE0B8'

/** The mine the runner walks onto, and the ones the sonar finds. */
const HIDDEN_MINE = { x: 152, y: 92 }
const FOUND_MINES = [
  { x: 192, y: 76 },
  { x: 196, y: 128 },
  { x: 226, y: 100 },
] as const

/** Where the runner is, as time goes on: straight lines between these. */
const PATH: readonly { at: number; x: number; y: number }[] = [
  { at: 0, x: START_X, y: 100 },
  { at: 300, x: START_X, y: 100 },
  { at: BLAST_AT, x: 140, y: 96 },
  // Thrown back a little by the blast.
  { at: BLAST_AT + 350, x: 128, y: 102 },
  { at: SONAR_AT, x: 150, y: 102 },
  { at: SONAR_AT + SCAN_HOLD_MS, x: 150, y: 102 },
  // Through the gap between the first two, then round under the third.
  { at: SONAR_AT + SCAN_HOLD_MS + 900, x: 182, y: 102 },
  { at: SONAR_AT + SCAN_HOLD_MS + 1_500, x: 206, y: 104 },
  { at: SONAR_AT + SCAN_HOLD_MS + 2_200, x: 228, y: 130 },
  { at: FINISH_AT, x: FINISH_X + 8, y: 124 },
  { at: LOOP_MS, x: FINISH_X + 8, y: 124 },
]

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

function positionAt(t: number): { x: number; y: number; heading: number; isMoving: boolean } {
  let index = 0
  while (index + 2 < PATH.length && t >= PATH[index + 1]!.at) index += 1
  const from = PATH[index]!
  const to = PATH[index + 1]!
  const amount = clamp01((t - from.at) / Math.max(1, to.at - from.at))
  const isMoving = (from.x !== to.x || from.y !== to.y) && amount < 1 && amount > 0
  return {
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
    heading: Math.atan2(to.y - from.y, to.x - from.x),
    isMoving,
  }
}

export function MinefieldDemo() {
  const t = useLoopTime(LOOP_MS)
  const { step, progress } = stepAt(t, [0, BLAST_STEP_AT, SONAR_STEP_AT, STANDINGS_AT], LOOP_MS)

  return (
    <DemoCard
      steps={STEPS}
      step={step}
      progress={progress}
      ariaLabel="How it works: everyone races across a field of hidden mines to the finish line. Walk too close to a mine and it goes off, costing one of your two lives. The sonar shows the mines nearby, but you stand still while it scans. First across the line wins."
      footnote="Arrows to move, Space for sonar — two blasts and you’re out."
    >
      {step === 3 ? <StandingsStep t={t} /> : <FieldStep t={t} />}
    </DemoCard>
  )
}

function FieldStep({ t }: { t: number }) {
  const runner = positionAt(t)
  const hasBlown = t >= BLAST_AT
  const lives = MINEFIELD.LIVES - (hasBlown ? 1 : 0)
  const isBlinking = hasBlown && t < BLAST_AT + PROTECTED_MS && Math.floor(t / 110) % 2 === 0
  const scan = t >= SONAR_AT ? clamp01((t - SONAR_AT) / SONAR_MS) : 0
  const isRevealed = t >= SONAR_AT + SONAR_MS * 0.5
  const isSonarLit = t >= SONAR_AT && t < SONAR_AT + 260
  const hasFinished = t >= FINISH_AT

  return (
    <>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        <Field />

        {/* The mines the sonar found, with how close is too close. */}
        {isRevealed &&
          FOUND_MINES.map(({ x, y }) => (
            <g key={`${x},${y}`} style={{ animation: 'pa-pop .3s ease-out' }}>
              <circle cx={x} cy={y} r={TRIGGER_RADIUS} fill={DANGER} fillOpacity={0.14} stroke={DANGER} strokeWidth={1.4} strokeDasharray="3 3" />
              <circle cx={x} cy={y} r={4} fill={MINE} stroke={color.ink} strokeWidth={1} />
              <circle cx={x - 1.2} cy={y - 1.2} r={1.1} fill={DANGER} />
            </g>
          ))}

        {/* The sonar pulse, spreading from where the runner stood. */}
        {scan > 0 && scan < 1 && (
          <circle
            cx={150}
            cy={102}
            r={SONAR_RADIUS * scan}
            fill={SONAR}
            fillOpacity={0.12 * (1 - scan)}
            stroke={SONAR}
            strokeWidth={2.5}
            strokeOpacity={1 - scan * 0.6}
          />
        )}

        <Blast t={t} />
        <Runner x={runner.x} y={runner.y} heading={runner.heading} isMoving={runner.isMoving} t={t} isHidden={isBlinking} />
        {hasFinished && <Flag t={t} />}
      </svg>

      <Hearts lives={lives} popIndex={hasBlown && t < BLAST_AT + 400 ? lives : null} />
      <SonarButton isLit={isSonarLit} />
    </>
  )
}

/** The sand, with the start line on the left and the chequered finish on the right. */
function Field() {
  const patches = Array.from({ length: 36 }, (_, index) => {
    const a = Math.sin(index * 91.7) * 4375.85
    const b = Math.sin(index * 37.3) * 1234.56
    return { x: (a - Math.floor(a)) * (VIEW_W + 300) - 150, y: (b - Math.floor(b)) * VIEW_H, r: 6 + (index % 5) * 3 }
  })
  const squares = Array.from({ length: Math.ceil((VIEW_H + 40) / 8) }, (_, index) => index)
  return (
    <g>
      <rect x={-FAR} y={-FAR} width={FAR * 2 + VIEW_W} height={FAR * 2 + VIEW_H} fill={SAND} />
      {patches.map(({ x, y, r }, index) => (
        <ellipse key={index} cx={x} cy={y} rx={r * 1.6} ry={r} fill={SAND_DARK} opacity={0.45} />
      ))}
      <line x1={START_X - 8} x2={START_X - 8} y1={-20} y2={VIEW_H + 20} stroke="#FFFFFF" strokeWidth={2.5} strokeDasharray="6 5" opacity={0.8} />
      {squares.map((index) => (
        <g key={index}>
          <rect x={FINISH_X} y={-20 + index * 8} width={4} height={4} fill={color.ink} />
          <rect x={FINISH_X + 4} y={-16 + index * 8} width={4} height={4} fill={color.ink} />
          <rect x={FINISH_X + 4} y={-20 + index * 8} width={4} height={4} fill="#FFFFFF" />
          <rect x={FINISH_X} y={-16 + index * 8} width={4} height={4} fill="#FFFFFF" />
        </g>
      ))}
    </g>
  )
}

/** A runner seen from above: shoulders, head, and arms swinging as they walk. */
function Runner({ x, y, heading, isMoving, t, isHidden }: { x: number; y: number; heading: number; isMoving: boolean; t: number; isHidden: boolean }) {
  const swing = isMoving ? Math.sin(t / 90) * 3 : 0
  const stroke = { stroke: color.ink, strokeWidth: 1.6, strokeLinecap: 'round' as const }
  return (
    <g transform={`translate(${x} ${y}) rotate(${(heading * 180) / Math.PI}) scale(${RUNNER_SCALE})`} opacity={isHidden ? 0.25 : 1}>
      <ellipse cx={1} cy={2} rx={7} ry={6} fill="rgba(0,0,0,0.15)" />
      <line x1={0} y1={-6} x2={4 + swing} y2={-8} {...stroke} strokeWidth={2.4} />
      <line x1={0} y1={6} x2={4 - swing} y2={8} {...stroke} strokeWidth={2.4} />
      <ellipse cx={0} cy={0} rx={5} ry={7.5} fill={RUNNER} {...stroke} />
      <circle cx={1.5} cy={0} r={4.2} fill={SKIN} {...stroke} />
      <path d="M -1.5 -3.6 A 4.2 4.2 0 0 0 -1.5 3.6 Z" fill={color.ink} />
    </g>
  )
}

/** The hidden mine going off: a burst, a ring, and sparks. */
function Blast({ t }: { t: number }) {
  const since = t - BLAST_AT
  if (since < 0 || since > 700) return null
  const p = since / 700
  const { x, y } = HIDDEN_MINE
  return (
    <g opacity={1 - p}>
      <circle cx={x} cy={y} r={6 + p * 22} fill="#FFA030" />
      <circle cx={x} cy={y} r={3 + p * 12} fill="#FFF0C0" />
      <circle cx={x} cy={y} r={8 + p * 30} fill="none" stroke="#FFF0C0" strokeWidth={2} />
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2
        return <circle key={index} cx={x + Math.cos(angle) * p * 34} cy={y + Math.sin(angle) * p * 34} r={1.8} fill="#FFD25A" />
      })}
    </g>
  )
}

/** A little flag waved at the finish. */
function Flag({ t }: { t: number }) {
  const wave = Math.sin(t / 120) * 2
  return (
    <g transform={`translate(${FINISH_X + 10} 106)`} style={{ animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)' }}>
      <line x1={0} y1={0} x2={0} y2={-18} stroke={color.ink} strokeWidth={1.6} />
      <path d={`M 0 -18 Q 7 ${-16 + wave} 13 -14 Q 7 ${-12 - wave} 0 -10 Z`} fill={color.pink} stroke={color.ink} strokeWidth={1.2} />
    </g>
  )
}

function Hearts({ lives, popIndex }: { lives: number; popIndex: number | null }) {
  return (
    <div style={{ position: 'absolute', top: stageSize(8, 4, 16), left: stageSize(10, 5, 20), pointerEvents: 'none' }}>
      <div style={{ ...sharedStyles.microLabel, fontSize: stageSize(8, 4, 12), color: color.ink, opacity: 0.6 }}>LIVES</div>
      <div style={{ display: 'flex', gap: 2, fontSize: stageSize(16, 9, 30), lineHeight: 1 }}>
        {Array.from({ length: MINEFIELD.LIVES }, (_, index) => (
          <span
            key={index}
            style={{
              color: index < lives ? color.pink : 'rgba(46,42,69,0.35)',
              textShadow: `0 2px 0 ${color.ink}`,
              transition: 'color .15s',
              animation: index === popIndex ? 'pa-pop .35s ease-out' : undefined,
            }}
          >
            ♥
          </span>
        ))}
      </div>
    </div>
  )
}

/** The game's sonar button, lighting up as it is pressed. */
function SonarButton({ isLit }: { isLit: boolean }) {
  const size = stageSize(40, 20, 64)
  return (
    <div
      style={{
        position: 'absolute',
        right: stageSize(10, 5, 20),
        bottom: stageSize(8, 4, 16),
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${color.ink}`,
        background: isLit ? SONAR : 'rgba(46, 42, 69, 0.55)',
        boxShadow: `0 3px 0 ${color.ink}`,
        transform: isLit ? 'translateY(2px)' : 'none',
        transition: 'background .1s, transform .1s',
        display: 'grid',
        placeItems: 'center',
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: stageSize(7, 3.5, 11),
        color: color.cream,
        pointerEvents: 'none',
      }}
    >
      SONAR
    </div>
  )
}

const label: CSSProperties = {
  ...sharedStyles.microLabel,
  letterSpacing: '0.22em',
  fontSize: stageSize(10, 5, 15),
  color: color.mutedStrong,
  whiteSpace: 'nowrap',
}

function StandingsStep({ t }: { t: number }) {
  const since = t - STANDINGS_AT
  return (
    <>
      <div style={label}>FIRST ACROSS WINS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: stageSize(340, 140, 480) }}>
        <DemoRow place="1st" name="You" note="" gain="+1" highlight visible={since > 300} />
        <DemoRow place="2nd" name="Sam" note="" gain="—" visible={since > 600} />
        <DemoRow place="3rd" name="Alex" note="" gain="—" visible={since > 900} />
      </div>
    </>
  )
}
