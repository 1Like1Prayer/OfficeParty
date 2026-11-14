import type { CSSProperties } from 'react'
import { CRUSHER_ESCALATOR } from '../../shared/games/crusherEscalator/constants.ts'
import type { Direction } from '../../shared/games/crusherEscalator/types.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import { DemoCard, DemoRow } from '../demo/DemoKit.tsx'
import { stepAt, useLoopTime } from '../demo/demoLoop.ts'
import { stageSize } from '../demo/stageSize.ts'
import { ARROW_OUTLINE, CORRECT_COLOR, ROTATION_DEGREES } from './arrowShape.ts'
import { DIRECTION_GLYPH } from './controls.ts'

/**
 * The race, played on a loop in miniature and seen from behind like the real
 * arena: two escalators over a black hole. Matching the arrow keeps you up
 * with the leader, wrong presses let them pull away and you slip down, and
 * once a runner is far enough behind the hole takes them. The last one running
 * takes the point. It stands in for the written rules on the reveal screen.
 *
 * Every frame is derived from the time into the loop, so it never drifts and
 * can be dropped in or out of the page at any moment.
 */

/** Timeline, in ms into the loop. */
const WRONG_STEP_AT = 3_400
const SWALLOW_STEP_AT = 6_400
const STANDINGS_AT = 10_600
const LOOP_MS = 14_200

const GAP = CRUSHER_ESCALATOR.ELIMINATION_GAP_START

interface Press {
  atMs: number
  /** The arrow showing when it was pressed. */
  shown: Direction
  pressed: Direction
}

const right = (atMs: number, shown: Direction): Press => ({ atMs, shown, pressed: shown })

/** Every press the demo player makes, in order. */
const PRESSES: readonly Press[] = [
  // Matching the arrow, in step with Sam.
  right(700, 'up'),
  right(1_300, 'left'),
  right(1_900, 'right'),
  right(2_500, 'down'),
  // Two wrong ones: the arrow still moves on, but no point.
  { atMs: 4_000, shown: 'right', pressed: 'left' },
  { atMs: 4_700, shown: 'up', pressed: 'down' },
  // A clean run while Sam fumbles, until Sam is a full gap behind.
  ...(['up', 'right', 'down', 'left', 'up', 'left', 'right', 'down', 'up', 'right'] as const).map((shown, index) =>
    right(6_800 + index * 240, shown),
  ),
]
/** The arrow showing once every press above has been made. */
const NEXT_ARROW: Direction = 'left'

/** When Sam scores. Level with you to begin with, then ahead while you go wrong, then stuck. */
const SAM_SCORES: readonly number[] = [700, 1_300, 1_900, 2_500, 4_000, 4_700]

/** How long a score takes to show in a runner's place on the escalator. */
const SLIDE_MS = 260
/** How long a press lights its key and colours the arrow. */
const FEEDBACK_MS = 220
const FALL_MS = 1_000

const correctTimes = PRESSES.filter(({ shown, pressed }) => shown === pressed).map(({ atMs }) => atMs)

/** When Sam ends up a whole gap behind and goes into the hole. */
const SAM_SWALLOWED_AT = (() => {
  for (const atMs of correctTimes) {
    const gap = correctTimes.filter((at) => at <= atMs).length - SAM_SCORES.filter((at) => at <= atMs).length
    if (gap >= GAP) return atMs
  }
  return Number.POSITIVE_INFINITY
})()

/*
 * The scene's own units. The SVG is fitted to the stage's height, so these map
 * to the same share of the stage at every size; the starfield and the hole run
 * far past the sides so a wide stage is filled edge to edge.
 */
const VIEW_W = 280
const VIEW_H = 200
const FAR = 2_000
const Y_BOTTOM = 178
const Y_TOP = 18
const W_BOTTOM = 66
const W_TOP = 24
/** How far up its escalator the leader runs, and the lowest anyone slips before the hole. */
const LEADER_S = 0.48
const LOWEST_S = 0.1
const TREAD_PITCH = 0.07
const TREAD_SPEED = 0.00012

const LANES = {
  you: { bottomX: 92, topX: 124 },
  sam: { bottomX: 188, topX: 156 },
} as const

const SPACE = '#0A051C'
const NEBULA = '#3A1E6E'
const RAMP = '#2A2540'
const RAMP_EDGE = '#4A4468'
const TREAD = '#D2CBE8'
const COMB = '#FFC400'
const HOLE_RIM = '#FF2A1A'
const HOLE_GLOW = '#FF8A6A'
const YOU_SHIRT = '#FF7A2E'
const SAM_SHIRT = '#5FD3FF'
const SKIN = '#FFE0B8'

const STEPS = ['Match the arrow', 'Miss and slip', 'Too far behind', 'Last one running'] as const

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** A score so far, easing in over `SLIDE_MS` so runners glide rather than jump. */
const smoothScore = (times: readonly number[], t: number): number =>
  times.reduce((sum, at) => sum + clamp01((t - at) / SLIDE_MS), 0)

const countAt = (times: readonly number[], t: number): number => times.filter((at) => at <= t).length

export function CrusherEscalatorDemo() {
  const t = useLoopTime(LOOP_MS)
  const { step, progress } = stepAt(t, [0, WRONG_STEP_AT, SWALLOW_STEP_AT, STANDINGS_AT], LOOP_MS)

  return (
    <DemoCard
      steps={STEPS}
      step={step}
      progress={progress}
      ariaLabel="How it works: everyone runs up their own escalator over a black hole. Press the arrow that is showing to score. Wrong presses let the leader pull away and you slip down; fall a whole gap behind the leader and the black hole swallows you. The last one running wins."
      footnote={`Arrow keys or WASD. The arrow moves on after every press, right or wrong. The gap that sends you in shrinks from ${GAP} to ${CRUSHER_ESCALATOR.ELIMINATION_GAP_MIN} as the race goes on.`}
    >
      {step === 3 ? <StandingsStep t={t} /> : <RaceStep t={t} step={step} />}
    </DemoCard>
  )
}

function RaceStep({ t, step }: { t: number; step: number }) {
  const yourScore = countAt(correctTimes, t)
  const samScore = countAt(SAM_SCORES, t)
  const smoothGap = smoothScore(SAM_SCORES, t) - smoothScore(correctTimes, t)
  const isSamGone = t >= SAM_SWALLOWED_AT
  const fall = isSamGone ? clamp01((t - SAM_SWALLOWED_AT) / FALL_MS) : 0

  // Like the arena: the leader holds the top spot and whoever is behind slips toward the hole.
  const slip = (gap: number) => LEADER_S - clamp01(gap / GAP) * (LEADER_S - LOWEST_S)
  const youS = slip(Math.max(0, smoothGap))
  const samS = isSamGone ? lerp(LOWEST_S, -0.2, fall) : slip(Math.max(0, -smoothGap))

  const madeSoFar = PRESSES.filter(({ atMs }) => atMs <= t)
  const last = madeSoFar.at(-1)
  const isFeedback = last !== undefined && t - last.atMs < FEEDBACK_MS
  const feedback = isFeedback ? (last.shown === last.pressed ? 'correct' : 'wrong') : null
  const arrow = isFeedback ? last.shown : (PRESSES[madeSoFar.length]?.shown ?? NEXT_ARROW)

  let caption: { text: string; tone: string; key: string } | null = null
  if (step === 0 && t >= 700) caption = { text: 'Match it: +1', tone: color.ink, key: 'match' }
  if (step === 1 && t >= 4_000) caption = { text: 'Wrong! No point', tone: color.red, key: 'wrong' }
  if (step === 2 && t >= 6_800) caption = { text: 'Pull away…', tone: color.ink, key: 'pull' }
  // Short enough to fit the narrowest phone.
  if (isSamGone) caption = { text: 'Sam’s swallowed!', tone: color.red, key: 'gone' }

  return (
    <>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        <Backdrop t={t} />
        <Escalator lane="sam" t={t} />
        <Escalator lane="you" t={t} />
        <BlackHole t={t} />
        <Runner
          lane="sam"
          s={samS}
          t={t}
          shirt={SAM_SHIRT}
          name="Sam"
          score={samScore}
          fall={fall}
        />
        <Runner
          lane="you"
          s={youS}
          t={t}
          shirt={YOU_SHIRT}
          name="You"
          isYou
          score={yourScore}
          fall={0}
        />
      </svg>

      <Prompt
        direction={arrow}
        feedback={feedback}
        pressed={isFeedback ? { direction: last.pressed, isRight: feedback === 'correct' } : null}
      />
      <GapBadge />

      {caption && (
        <div
          key={caption.key}
          style={{
            // Down over the hole, where nothing else is: the runners' tags are up top.
            position: 'absolute',
            bottom: stageSize(10, 6, 24),
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              padding: `${stageSize(2, 1, 4)} ${stageSize(10, 5, 16)}`,
              borderRadius: 999,
              border: `2px solid ${color.ink}`,
              background: color.white,
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: stageSize(14, 7, 24),
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              color: caption.tone,
              animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            {caption.text}
          </span>
        </div>
      )}

    </>
  )
}

/** Where on an escalator a point `s` of the way up sits, and how wide the ramp is there. */
function onRamp(lane: keyof typeof LANES, s: number): { x: number; y: number; width: number } {
  const { bottomX, topX } = LANES[lane]
  return { x: lerp(bottomX, topX, s), y: lerp(Y_BOTTOM, Y_TOP, s), width: lerp(W_BOTTOM, W_TOP, s) }
}

/** Deep space, with a fixed scatter of stars that twinkle. */
function Backdrop({ t }: { t: number }) {
  const stars = Array.from({ length: 90 }, (_, index) => {
    const a = Math.sin(index * 127.1) * 43758.5453
    const b = Math.sin(index * 311.7) * 12345.6789
    return { x: (a - Math.floor(a)) * (VIEW_W + 600) - 300, y: (b - Math.floor(b)) * VIEW_H, phase: index }
  })
  return (
    <g>
      <defs>
        <radialGradient id="ce-demo-nebula" gradientUnits="userSpaceOnUse" cx={VIEW_W / 2} cy={VIEW_H * 0.4} r={240}>
          <stop offset="0" stopColor={NEBULA} />
          <stop offset="1" stopColor={SPACE} />
        </radialGradient>
      </defs>
      <rect x={-FAR} y={-FAR} width={FAR * 2 + VIEW_W} height={FAR * 2 + VIEW_H} fill={SPACE} />
      <rect x={-FAR} y={-FAR} width={FAR * 2 + VIEW_W} height={FAR * 2 + VIEW_H} fill="url(#ce-demo-nebula)" />
      {stars.map(({ x, y, phase }) => (
        <circle
          key={phase}
          cx={x}
          cy={y}
          r={phase % 7 === 0 ? 1.3 : 0.8}
          fill="#FFFFFF"
          opacity={0.35 + 0.45 * Math.abs(Math.sin(t / 700 + phase))}
        />
      ))}
    </g>
  )
}

/** One escalator climbing away, its treads riding down toward the hole. */
function Escalator({ lane, t }: { lane: keyof typeof LANES; t: number }) {
  const bottom = onRamp(lane, -0.08)
  const top = onRamp(lane, 1)
  const offset = (t * TREAD_SPEED) % TREAD_PITCH
  const treads: number[] = []
  for (let s = TREAD_PITCH - offset; s < 1; s += TREAD_PITCH) treads.push(s)
  const ink = { stroke: color.ink, strokeWidth: 2, strokeLinejoin: 'round' as const }

  return (
    <g>
      <polygon
        points={`${bottom.x - bottom.width / 2 - 6},${bottom.y} ${top.x - top.width / 2 - 3},${top.y} ${top.x + top.width / 2 + 3},${top.y} ${bottom.x + bottom.width / 2 + 6},${bottom.y}`}
        fill={RAMP_EDGE}
        {...ink}
      />
      <polygon
        points={`${bottom.x - bottom.width / 2},${bottom.y} ${top.x - top.width / 2},${top.y} ${top.x + top.width / 2},${top.y} ${bottom.x + bottom.width / 2},${bottom.y}`}
        fill={RAMP}
      />
      {treads.map((s) => {
        const { x, y, width } = onRamp(lane, s)
        return (
          <line
            key={s}
            x1={x - width / 2}
            x2={x + width / 2}
            y1={y}
            y2={y}
            stroke={TREAD}
            strokeOpacity={0.25 + 0.35 * (1 - s)}
            strokeWidth={lerp(2.2, 0.8, s)}
          />
        )
      })}
      {/* The yellow comb plate where the steps disappear, right at the hole's edge. */}
      <line
        x1={bottom.x - bottom.width / 2}
        x2={bottom.x + bottom.width / 2}
        y1={bottom.y}
        y2={bottom.y}
        stroke={COMB}
        strokeWidth={3}
      />
    </g>
  )
}

/** The pit under the escalators: a glowing rim and a swirl, flattened by perspective. */
function BlackHole({ t }: { t: number }) {
  const spin = (t / 25) % 360
  return (
    <g>
      <defs>
        <radialGradient id="ce-demo-hole" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000000" />
          <stop offset="0.55" stopColor="#000000" />
          <stop offset="0.72" stopColor={HOLE_RIM} />
          <stop offset="0.85" stopColor={HOLE_GLOW} stopOpacity={0.6} />
          <stop offset="1" stopColor={HOLE_GLOW} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={VIEW_W / 2} cy={Y_BOTTOM + 22} rx={170} ry={30} fill="url(#ce-demo-hole)" />
      <g transform={`translate(${VIEW_W / 2} ${Y_BOTTOM + 22}) scale(1 0.18) rotate(${spin})`}>
        {[70, 95, 120].map((radius, index) => (
          <circle
            key={radius}
            r={radius}
            fill="none"
            stroke={index === 1 ? HOLE_GLOW : HOLE_RIM}
            strokeWidth={4}
            strokeDasharray={`${radius * 0.6} ${radius * 0.5}`}
            opacity={0.55}
          />
        ))}
      </g>
    </g>
  )
}

interface RunnerProps {
  lane: keyof typeof LANES
  /** How far up the escalator, 0 at the hole's edge; below 0 they are falling in. */
  s: number
  t: number
  shirt: string
  name: string
  isYou?: boolean
  /** Shown over their name, as the game's tags show it. */
  score: number
  /** 0 standing, to 1 gone into the hole. */
  fall: number
}

/** A runner seen from behind, climbing; their name tag and standing ride above. */
function Runner({ lane, s, t, shirt, name, isYou = false, score, fall }: RunnerProps) {
  const { x, y } = onRamp(lane, s)
  const scale = lerp(1.2, 0.65, clamp01(s))
  const stride = fall > 0 ? 0 : Math.sin(t / 110 + (isYou ? 0 : 1.7)) * 4
  const stroke = { stroke: color.ink, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const spin = fall * 540
  const opacity = 1 - clamp01((fall - 0.55) / 0.45)

  return (
    <g opacity={opacity}>
      <g transform={`translate(${x} ${y}) scale(${scale * (1 - fall * 0.6)}) rotate(${spin} 0 -20)`}>
        {/* Legs, stepping up */}
        <line x1={-4} y1={-16} x2={-5} y2={stride > 0 ? -stride : 0} {...stroke} strokeWidth={4.5} />
        <line x1={4} y1={-16} x2={5} y2={stride < 0 ? stride : 0} {...stroke} strokeWidth={4.5} />
        {/* Arms, swinging against the legs */}
        <line x1={-8} y1={-30} x2={-12} y2={-20 + stride} {...stroke} strokeWidth={3.5} />
        <line x1={8} y1={-30} x2={12} y2={-20 - stride} {...stroke} strokeWidth={3.5} />
        <rect x={-9} y={-34} width={18} height={20} rx={6} fill={shirt} {...stroke} />
        {/* The back of the head */}
        <circle cx={0} cy={-42} r={8.5} fill={SKIN} {...stroke} />
        <path d="M -8.5 -43 Q 0 -54 8.5 -43 Q 0 -46 -8.5 -43 Z" fill={color.ink} />
      </g>
      <Tag x={x} y={y - 62 * scale} name={name} isYou={isYou} score={score} />
    </g>
  )
}

/** The game's tag in miniature: the score over a name pill, and nothing about who leads. */
function Tag({ x, y, name, isYou, score }: { x: number; y: number; name: string; isYou: boolean; score: number }) {
  const width = 38
  return (
    <g transform={`translate(${x} ${y})`}>
      <text
        y={-12}
        textAnchor="middle"
        fontFamily={font.display}
        fontWeight={700}
        fontSize={11}
        fill={color.cream}
        stroke={color.ink}
        strokeWidth={3}
        paintOrder="stroke"
      >
        {score}
      </text>
      <rect x={-width / 2} y={-9} width={width} height={14} rx={7} fill={isYou ? '#FFC400' : '#FFFAF0'} stroke={color.ink} strokeWidth={1.8} />
      <text y={1.8} textAnchor="middle" fontFamily={font.display} fontWeight={700} fontSize={9} fill={color.ink}>
        {name}
      </text>
    </g>
  )
}

interface PromptProps {
  direction: Direction
  feedback: 'correct' | 'wrong' | null
  pressed: { direction: Direction; isRight: boolean } | null
}

/**
 * The arrow to press, as the game shows it: green or red for a moment after a
 * press. The keys sit under it, so what is asked and what was pressed read together.
 */
function Prompt({ direction, feedback, pressed }: PromptProps) {
  const fill = feedback === 'correct' ? CORRECT_COLOR : feedback === 'wrong' ? color.red : color.cream
  return (
    <div
      style={{
        position: 'absolute',
        top: stageSize(8, 4, 18),
        left: stageSize(10, 5, 20),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        pointerEvents: 'none',
      }}
    >
      <div style={{ ...sharedStyles.microLabel, fontSize: stageSize(8, 4, 12), color: color.cream, opacity: 0.75 }}>PRESS</div>
      <svg
        viewBox="0 0 100 100"
        style={{
          width: stageSize(30, 15, 56),
          height: stageSize(30, 15, 56),
          overflow: 'visible',
          filter: feedback === null ? undefined : `drop-shadow(0 0 6px ${fill})`,
        }}
      >
        <polygon
          points={ARROW_OUTLINE}
          fill={fill}
          stroke={fill}
          strokeWidth={5}
          strokeLinejoin="round"
          transform={`rotate(${ROTATION_DEGREES[direction]} 50 50)`}
        />
      </svg>
      <Keys pressed={pressed} />
    </div>
  )
}

/** How far behind sends you in, as the game shows it under the arrow. */
function GapBadge() {
  return (
    <div
      style={{
        position: 'absolute',
        top: stageSize(8, 4, 18),
        right: stageSize(10, 5, 20),
        textAlign: 'right',
        pointerEvents: 'none',
      }}
    >
      <div style={{ ...sharedStyles.microLabel, fontSize: stageSize(8, 4, 12), color: color.cream, opacity: 0.75 }}>CRUSHED AT</div>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: stageSize(14, 7, 24),
          lineHeight: 1.1,
          color: '#FF7A72',
          textShadow: `0 2px 0 ${color.ink}`,
          whiteSpace: 'nowrap',
        }}
      >
        {GAP} behind
      </div>
    </div>
  )
}

/** The arrow keys, laid out as on a keyboard; the pressed one lights green or red. */
function Keys({ pressed }: { pressed: { direction: Direction; isRight: boolean } | null }) {
  const key = (direction: Direction): CSSProperties => {
    const lit = pressed?.direction === direction
    const tone = pressed?.isRight ? CORRECT_COLOR : color.red
    return {
      width: stageSize(18, 9, 30),
      height: stageSize(18, 9, 30),
      borderRadius: 6,
      border: `2px solid ${color.ink}`,
      background: lit ? tone : 'rgba(46, 42, 69, 0.75)',
      color: color.cream,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: font.display,
      fontWeight: 700,
      fontSize: stageSize(10, 5, 16),
      transform: lit ? 'translateY(2px)' : 'none',
      transition: 'background .08s, transform .08s',
    }
  }
  return (
    <div
      style={{
        marginTop: stageSize(4, 2, 8),
        display: 'grid',
        gridTemplateColumns: 'repeat(3, auto)',
        gap: stageSize(2, 1, 4),
        pointerEvents: 'none',
      }}
    >
      <span />
      <div style={key('up')}>{DIRECTION_GLYPH.up}</div>
      <span />
      <div style={key('left')}>{DIRECTION_GLYPH.left}</div>
      <div style={key('down')}>{DIRECTION_GLYPH.down}</div>
      <div style={key('right')}>{DIRECTION_GLYPH.right}</div>
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
      <div style={label}>LAST ONE RUNNING WINS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: stageSize(340, 140, 480) }}>
        <DemoRow place="1st" name="You" note="still running" gain="+1" highlight visible={since > 300} />
        <DemoRow place="2nd" name="Sam" note="swallowed at 0:24" gain="—" visible={since > 600} />
        <DemoRow place="3rd" name="Alex" note="swallowed at 0:11" gain="—" visible={since > 900} />
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: stageSize(12, 6, 15),
          color: color.mutedStrong,
          opacity: since > 1400 ? 1 : 0,
          transition: 'opacity .3s ease',
        }}
      >
        Fall {GAP} behind the leader and the hole takes you.
      </div>
    </>
  )
}
