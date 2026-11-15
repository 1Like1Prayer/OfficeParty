import type { CSSProperties } from 'react'
import { HEX_DROP } from '../../shared/games/hexDrop/constants.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import { DemoCard, DemoRow } from '../demo/DemoKit.tsx'
import { stepAt, useLoopTime } from '../demo/demoLoop.ts'
import { stageSize } from '../demo/stageSize.ts'

/**
 * The round, played on a loop in miniature and seen side-on: the runner jumps
 * between the islands of the top floor, every tile they touch shakes and
 * drops a few seconds later, and when the one under them goes they fall to
 * the floor below and run on. It stands in for the written rules on the
 * reveal screen.
 *
 * Every frame is derived from the time into the loop, so it never drifts and
 * can be dropped in or out of the page at any moment.
 */

/** Timeline, in ms into the loop. */
const DROP_STEP_AT = 2_600
const FALL_STEP_AT = 6_200
const STANDINGS_AT = 9_600
const LOOP_MS = 13_000

/** A tile shakes and flashes for this long before it drops, then takes this long to fall away. */
const WARNING_MS = 1_000
const DROP_MS = 700

const STEPS = ['Jump the gaps', 'Tiles drop', 'Fall a floor', 'Last one standing'] as const

/*
 * The scene's own units. The SVG is fitted to the stage's height, so these map
 * to the same share of the stage at every size; the floors run far past the
 * sides so a wide stage is filled edge to edge.
 */
const VIEW_W = 280
const VIEW_H = 200
const FAR = 2_000
/** Each floor's top surface, top floor first, and the game's colour for it. */
const FLOORS = [
  { y: 58, color: '#FF6FAE' },
  { y: 98, color: '#FFC94A' },
  { y: 138, color: '#55D6A6' },
  { y: 178, color: '#6AA8FF' },
] as const
const TILE_W = 32
const TILE_H = 11
/** The top floor's islands, by their centres. */
const ISLANDS = [40, 92, 144, 196, 248] as const
const SKY_TOP = '#6E5BC8'
const SKY_BOTTOM = '#B79CE8'
/** The runner is drawn larger than the floors' scale, so they read at a glance. */
const RUNNER_SCALE = 1.4
const SHIRT = '#FF7A2E'
const SKIN = '#FFE0B8'

interface Leg {
  from: number
  to: number
  x0: number
  x1: number
  /** Feet height at the start and end of the leg (floor surfaces). */
  y0: number
  y1: number
  /** Jump height, for a jump between islands. */
  arc?: number
  /** Falling with the tile, rather than walking or jumping. */
  isFall?: boolean
}

const TOP = FLOORS[0].y
const SECOND = FLOORS[1].y
/** The last island drops from under the runner as the game's own delay runs out. */
const FALL_AT = 4_800 + HEX_DROP.FALL_DELAY_MS

/** The runner's route: walking, jumping between islands, and falling with the last tile. */
const LEGS: readonly Leg[] = [
  { from: 0, to: 300, x0: 40, x1: 40, y0: TOP, y1: TOP },
  { from: 300, to: 900, x0: 40, x1: 50, y0: TOP, y1: TOP },
  { from: 900, to: 1_500, x0: 50, x1: 84, y0: TOP, y1: TOP, arc: 18 },
  { from: 1_500, to: 1_900, x0: 84, x1: 102, y0: TOP, y1: TOP },
  { from: 1_900, to: 2_500, x0: 102, x1: 136, y0: TOP, y1: TOP, arc: 18 },
  { from: 2_500, to: 4_200, x0: 136, x1: 154, y0: TOP, y1: TOP },
  { from: 4_200, to: 4_800, x0: 154, x1: 188, y0: TOP, y1: TOP, arc: 18 },
  { from: 4_800, to: 5_600, x0: 188, x1: 196, y0: TOP, y1: TOP },
  // Waiting on the last island until it drops from under them.
  { from: 5_600, to: FALL_AT, x0: 196, x1: 196, y0: TOP, y1: TOP },
  { from: FALL_AT, to: FALL_AT + 520, x0: 196, x1: 200, y0: TOP, y1: SECOND, isFall: true },
  { from: FALL_AT + 520, to: FALL_AT + 2_000, x0: 200, x1: 250, y0: SECOND, y1: SECOND },
  { from: FALL_AT + 2_000, to: LOOP_MS, x0: 250, x1: 250, y0: SECOND, y1: SECOND },
]

/** When each island is first stood on: it drops `FALL_DELAY_MS` later. */
const ISLAND_TOUCHED_AT: Record<number, number> = { 40: 0, 92: 1_500, 144: 2_500, 196: 4_800 }

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

function runnerAt(t: number): { x: number; feetY: number; isAirborne: boolean; isRunning: boolean; isJumpStart: boolean } {
  const leg = LEGS.find(({ from, to }) => t >= from && t < to) ?? LEGS.at(-1)!
  const p = clamp01((t - leg.from) / (leg.to - leg.from))
  const x = lerp(leg.x0, leg.x1, p)
  let feetY = lerp(leg.y0, leg.y1, leg.isFall ? p * p : p)
  if (leg.arc !== undefined) feetY -= 4 * p * (1 - p) * leg.arc
  return {
    x,
    feetY,
    isAirborne: leg.arc !== undefined || leg.isFall === true,
    isRunning: leg.x0 !== leg.x1 && leg.arc === undefined && leg.isFall !== true,
    isJumpStart: leg.arc !== undefined && t - leg.from < 220,
  }
}

export function HexDropDemo() {
  const t = useLoopTime(LOOP_MS)
  const { step, progress } = stepAt(t, [0, DROP_STEP_AT, FALL_STEP_AT, STANDINGS_AT], LOOP_MS)

  return (
    <DemoCard
      steps={STEPS}
      step={step}
      progress={progress}
      ariaLabel="How it works: four floors of hexagon tiles, stacked. A tile drops a few seconds after anyone stands on it. The top floor is islands you jump between. Fall through all four floors and you are out; the last one standing wins."
      footnote="Arrows to move, Space to jump — fall through all four floors and you’re out."
    >
      {step === 3 ? <StandingsStep t={t} /> : <ArenaStep t={t} />}
    </DemoCard>
  )
}

function ArenaStep({ t }: { t: number }) {
  const runner = runnerAt(t)
  return (
    <>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="hd-demo-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={SKY_TOP} />
            <stop offset="1" stopColor={SKY_BOTTOM} />
          </linearGradient>
        </defs>
        <rect x={-FAR} y={-FAR} width={FAR * 2 + VIEW_W} height={FAR * 2 + VIEW_H} fill="url(#hd-demo-sky)" />

        {/* The solid floors below, widest at the bottom. */}
        {FLOORS.slice(1).map((floor) => (
          <g key={floor.y}>
            {Array.from({ length: 40 }, (_, index) => -400 + index * (TILE_W + 2)).map((x) => (
              <Tile key={x} x={x} y={floor.y} fill={floor.color} />
            ))}
          </g>
        ))}

        {/* The islands of the top floor, each dropping a while after it was stood on. */}
        {ISLANDS.map((x) => {
          const touchedAt = ISLAND_TOUCHED_AT[x]
          const dropsAt = touchedAt === undefined ? Infinity : touchedAt + HEX_DROP.FALL_DELAY_MS
          const warning = t >= dropsAt - WARNING_MS && t < dropsAt
          const falling = t >= dropsAt ? clamp01((t - dropsAt) / DROP_MS) : 0
          if (falling >= 1) return null
          const shake = warning ? Math.sin(t / 30) * 1.2 : 0
          return (
            <g key={x} opacity={1 - falling} transform={`translate(${shake} ${falling * falling * 60})`}>
              <Tile
                x={x - TILE_W / 2}
                y={TOP}
                fill={warning && Math.floor(t / 120) % 2 === 0 ? '#FFF6E8' : FLOORS[0].color}
              />
            </g>
          )
        })}

        <Runner x={runner.x} feetY={runner.feetY} isAirborne={runner.isAirborne} isRunning={runner.isRunning} t={t} />
      </svg>

      <Keys isRunning={runner.isRunning} isJumping={runner.isJumpStart} />
    </>
  )
}

/** A hexagonal tile seen side-on: its top face and its bevelled ends. */
function Tile({ x, y, fill }: { x: number; y: number; fill: string }) {
  const bevel = 4
  return (
    <path
      d={`M ${x} ${y} L ${x + TILE_W} ${y} L ${x + TILE_W - bevel} ${y + TILE_H} L ${x + bevel} ${y + TILE_H} Z`}
      fill={fill}
      stroke={color.ink}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  )
}

/** A runner seen side-on, facing the way they go; legs tuck in the air. */
function Runner({ x, feetY, isAirborne, isRunning, t }: { x: number; feetY: number; isAirborne: boolean; isRunning: boolean; t: number }) {
  const stride = isRunning ? Math.sin(t / 80) * 4 : 0
  const stroke = { stroke: color.ink, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const hip = feetY - 8
  return (
    <g transform={`translate(${x} ${feetY}) scale(${RUNNER_SCALE}) translate(${-x} ${-feetY})`}>
      <line x1={x} y1={hip} x2={x + stride - (isAirborne ? 3 : 0)} y2={isAirborne ? feetY - 3 : feetY} {...stroke} strokeWidth={3} />
      <line x1={x} y1={hip} x2={x - stride + (isAirborne ? 3 : 0)} y2={isAirborne ? feetY - 3 : feetY} {...stroke} strokeWidth={3} />
      <line x1={x} y1={hip - 9} x2={x + (isAirborne ? 5 : -stride * 0.8)} y2={isAirborne ? hip - 15 : hip - 2} {...stroke} strokeWidth={2.4} />
      <rect x={x - 4.5} y={hip - 12} width={9} height={13} rx={4} fill={SHIRT} {...stroke} />
      <circle cx={x + 0.5} cy={hip - 17} r={5.5} fill={SKIN} {...stroke} />
      <circle cx={x + 3} cy={hip - 18} r={0.9} fill={color.ink} />
    </g>
  )
}

/** The game's keys: → lights while running, SPACE as a jump starts. */
function Keys({ isRunning, isJumping }: { isRunning: boolean; isJumping: boolean }) {
  const key = (isLit: boolean, wide = false): CSSProperties => ({
    minWidth: wide ? stageSize(44, 22, 76) : stageSize(22, 11, 38),
    height: stageSize(22, 11, 38),
    padding: `0 ${stageSize(4, 2, 8)}`,
    borderRadius: 6,
    border: `2px solid ${color.ink}`,
    background: isLit ? color.cream : 'rgba(46, 42, 69, 0.75)',
    color: isLit ? color.ink : color.cream,
    display: 'grid',
    placeItems: 'center',
    fontFamily: font.display,
    fontWeight: 700,
    fontSize: stageSize(9, 4.5, 15),
    transform: isLit ? 'translateY(2px)' : 'none',
    transition: 'background .08s, transform .08s',
  })
  return (
    <div
      style={{
        position: 'absolute',
        right: stageSize(10, 5, 20),
        bottom: stageSize(8, 4, 16),
        display: 'flex',
        gap: stageSize(3, 1.5, 6),
        pointerEvents: 'none',
      }}
    >
      <div style={key(isRunning)}>→</div>
      <div style={key(isJumping, true)}>SPACE</div>
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
      <div style={label}>LAST ONE STANDING WINS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: stageSize(340, 140, 480) }}>
        <DemoRow place="1st" name="You" note="" gain="+1" highlight visible={since > 300} />
        <DemoRow place="2nd" name="Sam" note="" gain="—" visible={since > 600} />
        <DemoRow place="3rd" name="Alex" note="" gain="—" visible={since > 900} />
      </div>
    </>
  )
}
