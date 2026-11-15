import { useEffect, useRef, type CSSProperties } from 'react'
import { battleBar } from '../../shared/games/mageBattle/progress.ts'
import type { Dial } from '../../shared/games/mageBattle/types.ts'
import { color, font, sharedStyles } from '../../theme/index.ts'
import type { RoundPlayerView } from '../../types/index.ts'
import { DemoCard, DemoRow } from '../demo/DemoKit.tsx'
import { stepAt, useLoopTime } from '../demo/demoLoop.ts'
import { stageSize } from '../demo/stageSize.ts'
import { BattleBar } from './ui/BattleBar.tsx'
import { BLOCK_COLORS, drawDial } from './ui/drawDial.ts'

/**
 * The round, played on a loop in miniature with the game's own dial and
 * battle bar: three spins of the dial (a hit, a bigger hit on a smaller
 * block, a miss), then the bar as the leader pulls away until a mage falls
 * seven behind and is knocked out, then the standings. It stands in for the
 * written rules on the reveal screen.
 *
 * Every frame is derived from the time into the loop, so it never drifts and
 * can be dropped in or out of the page at any moment.
 */

/** Timeline, in ms into the loop. */
const BAR_STEP_AT = 6_000
const STANDINGS_AT = 10_600
const LOOP_MS = 14_000

const STEPS = ['Stop on a block', '7 behind is out', 'Most points wins'] as const

/** Each spin of the dial is one turn in this long. */
const SPIN_MS = 2_000
/** How long a press's ring flash and "+2" stay up. */
const FLASH_MS = 600

interface DemoSpin {
  level: number
  /** Where the first block starts, degrees clockwise from the top. */
  zone: number
  /** Where the needle is when they press. */
  pressAt: number
  /** What the press scores: 0 is a miss. */
  points: number
}

/** Three spins: a 2 on the big easy blocks, a 4 on the smallest, then a press that comes too late. */
const SPINS: readonly DemoSpin[] = [
  { level: 0, zone: 110, pressAt: 164, points: 2 },
  { level: 1, zone: 190, pressAt: 241, points: 4 },
  { level: 2, zone: 130, pressAt: 172, points: 0 },
]

const PLAYERS: readonly RoundPlayerView[] = [
  { playerId: 'you', name: 'You', initial: 'Y', color: '#FF5FA2', avatar: 'mug' },
  { playerId: 'sam', name: 'Sam', initial: 'S', color: '#5AA9FF', avatar: 'lamp' },
  { playerId: 'alex', name: 'Alex', initial: 'A', color: '#FFD24A', avatar: 'cactus' },
]

/** The scores over the bar step: you pull away, Sam keeps up, and Alex falls seven behind. */
const SCORE_EVENTS: readonly { at: number; playerId: string; points: number }[] = [
  { at: BAR_STEP_AT + 700, playerId: 'you', points: 2 },
  { at: BAR_STEP_AT + 1_600, playerId: 'sam', points: 2 },
  { at: BAR_STEP_AT + 2_500, playerId: 'you', points: 1 },
]
const STARTING_SCORES: Readonly<Record<string, number>> = { you: 5, sam: 4, alex: 1 }

export function MageBattleDemo() {
  const t = useLoopTime(LOOP_MS)
  const { step, progress } = stepAt(t, [0, BAR_STEP_AT, STANDINGS_AT], LOOP_MS)

  return (
    <DemoCard
      steps={STEPS}
      step={step}
      progress={progress}
      ariaLabel="How it works: a dial spins round. Press once per spin while the needle is over a block to score its points; the smaller the block, the more it is worth. Fall seven points behind the leader and you are knocked out. The most points wins."
      footnote="Space or tap while the needle is on a block — one press per spin."
    >
      {step === 0 && <DialStep t={t} />}
      {step === 1 && <BarStep t={t} />}
      {step === 2 && <StandingsStep t={t} />}
    </DemoCard>
  )
}

/** The night sky the game is played under, so the dial and bar sit on what they were drawn for. */
const night: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(circle at 50% 50%, #4A3F8C 0%, #2B2F55 45%, #1B2240 100%)',
}

function DialStep({ t }: { t: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const index = Math.min(SPINS.length - 1, Math.max(0, Math.floor(t / SPIN_MS)))
  const spin = SPINS[index]!
  const sinceSpin = t - index * SPIN_MS
  const needle = (sinceSpin / SPIN_MS) * 360
  const pressedAtMs = (spin.pressAt / 360) * SPIN_MS
  const hasPressed = sinceSpin >= pressedAtMs
  const sincePress = sinceSpin - pressedAtMs
  const flashStrength = hasPressed ? Math.max(0, 1 - sincePress / FLASH_MS) : 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const dial: Dial = {
      level: spin.level,
      sinceMs: 0,
      zone: spin.zone,
      spin: index,
      score: 0,
      pressPoints: hasPressed ? spin.points : null,
      pressedAtMs: hasPressed ? pressedAtMs : null,
      outAtMs: null,
    }
    const flash =
      flashStrength > 0
        ? { color: spin.points > 0 ? BLOCK_COLORS[spin.points] ?? color.cream : '#E5382F', strength: flashStrength, isMiss: spin.points === 0 }
        : null
    drawDial(canvas, dial, needle, hasPressed ? spin.pressAt : null, flash)
  })

  const isCalloutUp = hasPressed && sincePress < 900
  return (
    <>
      <div style={night} />
      <div style={{ position: 'relative', width: stageSize(150, 82, 290), aspectRatio: '1' }}>
        {/* The clash, glowing through the middle of the dial. */}
        <div
          style={{
            position: 'absolute',
            inset: '28%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #FFFFFF 0%, #E8DCFF 22%, rgba(159,134,255,0.55) 50%, rgba(159,134,255,0) 72%)',
            transform: `scale(${1 + 0.06 * Math.sin(t / 90) + (spin.points > 0 ? flashStrength * 0.35 : 0)})`,
          }}
        />
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
        {isCalloutUp && (
          <div
            key={index}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: spin.points > 0 ? stageSize(30, 16, 56) : stageSize(20, 10, 34),
              color: spin.points > 0 ? BLOCK_COLORS[spin.points] : '#FF7A72',
              textShadow: `0 3px 0 ${color.ink}`,
              animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            {spin.points > 0 ? `+${spin.points}` : 'MISS'}
          </div>
        )}
      </div>
      <SpaceKey isLit={hasPressed && sincePress < 160} />
    </>
  )
}

/** The game's key: SPACE lights as they press. */
function SpaceKey({ isLit }: { isLit: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: stageSize(10, 5, 20),
        bottom: stageSize(8, 4, 16),
        minWidth: stageSize(44, 22, 76),
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
        pointerEvents: 'none',
      }}
    >
      SPACE
    </div>
  )
}

/** Everyone's score at `t`, and whether Alex has fallen seven behind yet. */
function scoresAt(t: number): { playerId: string; score: number; out: boolean }[] {
  const scores = { ...STARTING_SCORES }
  for (const event of SCORE_EVENTS) if (t >= event.at) scores[event.playerId]! += event.points
  const leader = Math.max(...Object.values(scores))
  return PLAYERS.map(({ playerId }) => ({ playerId, score: scores[playerId]!, out: leader - scores[playerId]! >= 7 }))
}

function BarStep({ t }: { t: number }) {
  const bar = battleBar(scoresAt(t))
  return (
    <>
      <div style={night} />
      <div style={{ position: 'relative', width: '100%', maxWidth: stageSize(300, 150, 560) }}>
        <BattleBar bar={bar} players={PLAYERS} selfPlayerId="you" />
      </div>
    </>
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
  const final = scoresAt(LOOP_MS)
  const points = (playerId: string) => {
    const score = final.find((entry) => entry.playerId === playerId)?.score ?? 0
    return `${score} ${score === 1 ? 'point' : 'points'}`
  }
  return (
    <>
      <div style={label}>MOST POINTS WINS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: stageSize(340, 140, 480) }}>
        <DemoRow place="1st" name="You" note={points('you')} gain="+1" highlight visible={since > 300} />
        <DemoRow place="2nd" name="Sam" note={points('sam')} gain="—" visible={since > 600} />
        <DemoRow place="3rd" name="Alex" note={points('alex')} gain="—" visible={since > 900} />
      </div>
    </>
  )
}
