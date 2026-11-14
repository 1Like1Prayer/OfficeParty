import type { CSSProperties } from 'react'
import { LOG_DODGE } from '../../shared/games/logDodge/constants.ts'
import type { Action } from '../../shared/games/logDodge/types.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import { DemoCard, DemoRow } from '../demo/DemoKit.tsx'
import { stepAt, useLoopTime } from '../demo/demoLoop.ts'
import { stageSize } from '../demo/stageSize.ts'
import { ACTION_INFO, ACTION_ORDER } from './controls.ts'

/**
 * The round, played on a loop in miniature and seen side-on: a low log rolls
 * in and is jumped, a high one is ducked, a missed one costs a heart, and the
 * last one running takes the point. It stands in for the written rules on the
 * reveal screen.
 *
 * Every frame is derived from the time into the loop, so it never drifts and
 * can be dropped in or out of the page at any moment.
 */

/** Timeline, in ms into the loop. Each step's log reaches the runner at its ARRIVE time. */
const DUCK_STEP_AT = 3_000
const HIT_STEP_AT = 6_200
const STANDINGS_AT = 9_400
const LOOP_MS = 13_000

const JUMP_ARRIVE = 2_200
const DUCK_ARRIVE = 5_300
const HIT_ARRIVE = 8_000
/** The demo player presses a beat before the log arrives, well inside the real hit window. */
const PRESS_LEAD_MS = 260
const JUMP_MS = 620
const DUCK_MS = 650
const PRESSED_MS = 240

/*
 * The scene's own units. The SVG is fitted to the stage's height, so these map
 * to the same share of the stage at every size; the sky, deck and sea run far
 * past the sides so a wide stage is filled edge to edge.
 */
const VIEW_W = 280
const VIEW_H = 200
const DECK_Y = 140
const DECK_DEPTH = 16
const RUNNER_X = 96
/** Scene units per ms a log travels. Logs come in from beyond the stage's right edge. */
const LOG_SPEED = 0.25
const LOG_R = 14
const LOW_LOG_Y = DECK_Y - LOG_R
const HIGH_LOG_Y = 80
const JUMP_HEIGHT = 48
/** A duck squashes the runner to this share of their height, under a high log. */
const DUCK_SCALE = 0.62
const FAR = 2_000

const SKY_TOP = '#8ED1FF'
const SKY_BOTTOM = '#D3EEFF'
const SEA = '#2B86D1'
const SEA_LIGHT = '#7CC4F5'
const BELT = '#2B2E35'
const STEEL = '#7F8895'
const LOG_BARK = '#9A6332'
const LOG_GRAIN = '#E0AE72'
const RUNNER_SHIRT = '#FF7A2E'
const RUNNER_SKIN = '#FFE0B8'
const HEART_ON = color.pink
const HEART_OFF = '#4A3F78'

const STEPS = ['Jump low logs', 'Duck high logs', 'A hit costs a life', 'Last one standing'] as const

/** 0 → 1 → 0 over `ms` from `from`, or 0 outside it. */
const arc = (t: number, from: number, ms: number): number => {
  const p = (t - from) / ms
  return p <= 0 || p >= 1 ? 0 : 4 * p * (1 - p)
}

const during = (t: number, from: number, ms: number): boolean => t >= from && t < from + ms

export function LogDodgeDemo() {
  const t = useLoopTime(LOOP_MS)
  const { step, progress } = stepAt(t, [0, DUCK_STEP_AT, HIT_STEP_AT, STANDINGS_AT], LOOP_MS)

  return (
    <DemoCard
      steps={STEPS}
      step={step}
      progress={progress}
      ariaLabel="How it works: everyone runs on a treadmill while logs roll in. Jump the low ones, duck the high ones. A missed log costs one of three lives, and the last one still running wins."
      footnote="↑ or Space to jump, ↓ to duck. The logs come faster, and from wilder angles, as the minute goes on."
    >
      {step === 3 ? <StandingsStep t={t} /> : <RunStep t={t} step={step} />}
    </DemoCard>
  )
}

function RunStep({ t, step }: { t: number; step: number }) {
  const arrive = [JUMP_ARRIVE, DUCK_ARRIVE, HIT_ARRIVE][step]!
  const high = step !== 0
  const action: Action | null = step === 0 ? 'jump' : step === 1 ? 'duck' : null
  const pressAt = arrive - PRESS_LEAD_MS

  const lift = action === 'jump' ? arc(t, pressAt, JUMP_MS) * JUMP_HEIGHT : 0
  const ducking = action === 'duck' && during(t, pressAt, DUCK_MS)
  const hit = step === 2 && t >= HIT_ARRIVE
  const flashing = hit && t < HIT_ARRIVE + 450
  // Knocked back a step by the hit, then jogs back into place.
  const knock = hit ? arc(t, HIT_ARRIVE, 700) * 10 : 0

  const logX = RUNNER_X + (arrive - t) * LOG_SPEED
  const lives = LOG_DODGE.MAX_HITS - (hit ? 1 : 0)
  const pressed = action !== null && during(t, pressAt, PRESSED_MS) ? action : null

  let caption: { text: string; tone: string; key: string } | null = null
  if (action === 'jump' && t >= pressAt) caption = { text: 'Jump!', tone: color.ink, key: 'jump' }
  if (action === 'duck' && t >= pressAt) caption = { text: 'Duck!', tone: color.ink, key: 'duck' }
  // Short enough to sit beside the hearts on the narrowest phone.
  if (hit) caption = { text: 'Ouch! −1 ♥', tone: color.red, key: 'hit' }

  return (
    <>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        <Backdrop t={t} />
        <Runner t={t} lift={lift} ducking={ducking} flashing={flashing} knock={knock} />
        <RollingLog x={logX} y={high ? HIGH_LOG_Y : LOW_LOG_Y} />
      </svg>

      <Hearts lives={lives} popIndex={hit ? lives : null} />

      {caption && (
        <div
          key={caption.key}
          style={{
            position: 'absolute',
            top: stageSize(10, 6, 22),
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* A pill, so it reads against the light sky. */}
          <span
            style={{
              padding: `${stageSize(2, 1, 4)} ${stageSize(10, 5, 16)}`,
              borderRadius: 999,
              border: `2px solid ${color.ink}`,
              background: color.white,
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: stageSize(15, 7.5, 26),
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

      <Keys pressed={pressed} />
    </>
  )
}

/** Sky, the treadmill deck with its belt running back under the runner, its piers, and the sea. */
function Backdrop({ t }: { t: number }) {
  const belt = (t * LOG_SPEED) % 24
  const swell = (t * 0.02) % 40

  return (
    <g>
      <defs>
        <linearGradient id="ld-demo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SKY_TOP} />
          <stop offset="1" stopColor={SKY_BOTTOM} />
        </linearGradient>
      </defs>
      <rect x={-FAR} y={-FAR} width={FAR * 2 + VIEW_W} height={FAR + DECK_Y} fill={SKY_TOP} />
      <rect x={-FAR} y={0} width={FAR * 2 + VIEW_W} height={DECK_Y} fill="url(#ld-demo-sky)" />

      <rect x={-FAR} y={DECK_Y} width={FAR * 2 + VIEW_W} height={FAR} fill={SEA} />
      {[DECK_Y + DECK_DEPTH + 12, DECK_Y + DECK_DEPTH + 28, DECK_Y + DECK_DEPTH + 44].map((y, index) => (
        <line
          key={y}
          x1={-FAR}
          x2={FAR + VIEW_W}
          y1={y}
          y2={y}
          stroke={SEA_LIGHT}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="14 26"
          strokeDashoffset={index % 2 === 0 ? swell : -swell}
          opacity={0.7}
        />
      ))}

      {/* Piers down into the water. */}
      {Array.from({ length: 41 }, (_, index) => (index - 20) * 70 + 20).map((x) => (
        <rect key={x} x={x} y={DECK_Y + DECK_DEPTH} width={8} height={30} fill={STEEL} stroke={color.ink} strokeWidth={1.5} />
      ))}

      <rect x={-FAR} y={DECK_Y} width={FAR * 2 + VIEW_W} height={DECK_DEPTH} fill={BELT} />
      <line
        x1={-FAR}
        x2={FAR + VIEW_W}
        y1={DECK_Y + DECK_DEPTH / 2}
        y2={DECK_Y + DECK_DEPTH / 2}
        stroke="#FFFFFF"
        strokeOpacity={0.3}
        strokeWidth={2}
        strokeDasharray="12 12"
        strokeDashoffset={belt}
      />
      <line x1={-FAR} x2={FAR + VIEW_W} y1={DECK_Y} y2={DECK_Y} stroke={color.yellow} strokeWidth={2.5} />
      <line x1={-FAR} x2={FAR + VIEW_W} y1={DECK_Y + DECK_DEPTH} y2={DECK_Y + DECK_DEPTH} stroke={color.ink} strokeWidth={2} />
    </g>
  )
}

interface RunnerProps {
  t: number
  lift: number
  ducking: boolean
  flashing: boolean
  knock: number
}

function Runner({ t, lift, ducking, flashing, knock }: RunnerProps) {
  // The legs keep running on the belt, except mid-air, where they tuck.
  const airborne = lift > 2
  const stride = airborne ? 0 : Math.sin(t / 85) * 7
  const x = RUNNER_X - knock
  const stroke = { stroke: color.ink, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const squash = ducking ? `translate(${x} ${DECK_Y}) scale(1.08 ${DUCK_SCALE}) translate(${-x} ${-DECK_Y})` : undefined

  return (
    <g transform={`translate(0 ${-lift})`}>
      <g transform={squash} opacity={flashing && Math.floor(t / 90) % 2 === 0 ? 0.35 : 1}>
        {/* Legs */}
        <line x1={x} y1={120} x2={x + stride - (airborne ? 6 : 0)} y2={airborne ? 134 : DECK_Y} {...stroke} strokeWidth={5} />
        <line x1={x} y1={120} x2={x - stride + (airborne ? 6 : 0)} y2={airborne ? 134 : DECK_Y} {...stroke} strokeWidth={5} />
        {/* Arms, swinging against the legs */}
        <line x1={x} y1={102} x2={x - stride * 0.9 + 2} y2={116} {...stroke} strokeWidth={4} />
        <line x1={x} y1={102} x2={x + stride * 0.9 + 2} y2={116} {...stroke} strokeWidth={4} />
        {/* Body */}
        <rect x={x - 8} y={96} width={16} height={26} rx={6} fill={flashing ? '#FF7A72' : RUNNER_SHIRT} {...stroke} />
        {/* Head, facing the logs */}
        <circle cx={x + 1} cy={84} r={11} fill={RUNNER_SKIN} {...stroke} />
        <circle cx={x + 6} cy={82} r={1.6} fill={color.ink} />
        <path d={`M ${x - 9} ${80} Q ${x} ${68} ${x + 11} ${79}`} fill="none" {...stroke} strokeWidth={4} />
      </g>
    </g>
  )
}

/** A log seen end-on, turning as it rolls towards the runner. */
function RollingLog({ x, y }: { x: number; y: number }) {
  const turn = (-(x / LOG_R) * 180) / Math.PI
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`}>
      <circle r={LOG_R} fill={LOG_BARK} stroke={color.ink} strokeWidth={2.5} />
      <circle r={LOG_R - 4.5} fill={LOG_GRAIN} stroke={color.ink} strokeWidth={1.2} />
      <circle r={LOG_R - 9} fill="none" stroke={LOG_BARK} strokeWidth={1.4} />
      <line x1={0} y1={0} x2={LOG_R - 5} y2={0} stroke={LOG_BARK} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

function Hearts({ lives, popIndex }: { lives: number; popIndex: number | null }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: stageSize(8, 4, 16),
        right: stageSize(10, 5, 20),
        textAlign: 'right',
        pointerEvents: 'none',
      }}
    >
      <div style={{ ...sharedStyles.microLabel, fontSize: stageSize(8, 4, 12), color: color.ink, opacity: 0.6 }}>LIVES</div>
      <div style={{ display: 'flex', gap: 2, fontSize: stageSize(16, 9, 30), lineHeight: 1 }}>
        {Array.from({ length: LOG_DODGE.MAX_HITS }, (_, index) => (
          <span
            key={index}
            style={{
              color: index < lives ? HEART_ON : HEART_OFF,
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

/** The game's own key reminder: lights up the key as it is pressed. */
function Keys({ pressed }: { pressed: Action | null }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: stageSize(6, 3, 14),
        display: 'flex',
        justifyContent: 'center',
        gap: stageSize(6, 3, 10),
        pointerEvents: 'none',
      }}
    >
      {ACTION_ORDER.map((action) => {
        const info = ACTION_INFO[action]
        const lit = pressed === action
        const key: CSSProperties = {
          minWidth: stageSize(48, 24, 80),
          padding: `${stageSize(2, 1, 5)} ${stageSize(6, 3, 12)}`,
          borderRadius: 10,
          border: `2px solid ${color.ink}`,
          background: lit ? color.cream : 'rgba(46, 42, 69, 0.55)',
          color: lit ? color.ink : color.cream,
          textAlign: 'center',
          transform: lit ? 'translateY(2px)' : 'none',
          transition: 'background .08s, color .08s, transform .08s',
        }
        return (
          <div key={action} style={key}>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: stageSize(13, 7, 22), lineHeight: 1.1 }}>
              {info.glyph}
            </div>
            <div style={{ ...sharedStyles.microLabel, fontSize: stageSize(8, 4, 12), color: 'inherit', opacity: 0.85 }}>
              {info.label.toUpperCase()}
            </div>
          </div>
        )
      })}
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
        <DemoRow place="2nd" name="Sam" note="thrown off at 0:52" gain="—" visible={since > 600} />
        <DemoRow place="3rd" name="Alex" note="thrown off at 0:31" gain="—" visible={since > 900} />
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
        Three hits and you’re thrown off the back.
      </div>
    </>
  )
}
