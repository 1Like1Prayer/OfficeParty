import type { CSSProperties } from 'react'
import type { Box } from '../../shared/games/cubeCounter/types.ts'
import { border, color, fluid, font, lift, sharedStyles } from '../../theme/index.ts'
import { DemoCard, DemoRow } from '../demo/DemoKit.tsx'
import { stepAt, useLoopTime } from '../demo/demoLoop.ts'
import { stageSize } from '../demo/stageSize.ts'
import { IsoScene } from './IsoScene.tsx'
import { SCENE_ASPECT } from './projection.ts'

/**
 * One puzzle, played on a loop in miniature: the pile flashes up, vanishes,
 * the count gets typed in, the answer is shown, and the standings reward the
 * most right answers with speed as the tiebreak. It stands in for the written
 * rules on the reveal screen.
 *
 * Every frame is derived from the time into the loop, so it never drifts and
 * can be dropped in or out of the page at any moment.
 */

/** Timeline, in ms into the loop. */
const HIDE_AT = 2_600
/** The typed digit lands here, and Enter a beat later so both can be read. */
const TYPE_AT = 4_000
const ENTER_AT = 5_000
const CHECK_AT = 5_600
const STANDINGS_AT = 7_600
const LOOP_MS = 11_600

/**
 * A small pile that passes the real scene rules: a stack of two, and two wide
 * blocks that each count once. Six blocks in all.
 */
const SCENE: readonly Box[] = [
  { x: 0, y: 1, z: 0, width: 2, depth: 1 },
  { x: 2, y: 0, z: 0, width: 1, depth: 1 },
  { x: 2, y: 0, z: 1, width: 1, depth: 1 },
  { x: 1, y: 3, z: 0, width: 1, depth: 2 },
  { x: 3, y: 2, z: 0, width: 1, depth: 1 },
  { x: 4, y: 4, z: 0, width: 1, depth: 1 },
]
const ANSWER = SCENE.length

/** How much of the answer clock the demo player uses before pressing Enter. */
const TIME_USED_AT_ENTER = 0.32

const STEPS = ['Blocks flash', 'Type how many', 'See the answer', 'Most right wins'] as const

const label: CSSProperties = {
  ...sharedStyles.microLabel,
  letterSpacing: '0.22em',
  fontSize: stageSize(10, 5, 15),
  color: color.mutedStrong,
  whiteSpace: 'nowrap',
}

const caption: CSSProperties = {
  fontFamily: font.display,
  fontWeight: 700,
  fontSize: stageSize(17, 8.5, 26),
  lineHeight: 1.1,
}

const sceneBox: CSSProperties = {
  height: stageSize(120, 60, 230),
  aspectRatio: String(SCENE_ASPECT),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export function CubeCounterDemo() {
  const t = useLoopTime(LOOP_MS)
  const { step, progress } = stepAt(t, [0, HIDE_AT, CHECK_AT, STANDINGS_AT], LOOP_MS)

  return (
    <DemoCard
      steps={STEPS}
      step={step}
      progress={progress}
      ariaLabel="How it works: a pile of blocks flashes up and vanishes, you type how many there were, and the most right answers win, with speed breaking ties."
      footnote="Wide blocks count once — and the piles get bigger as you go."
    >
      {step === 0 && <FlashStep t={t} />}
      {step === 1 && <AnswerStep t={t} />}
      {step === 2 && <CheckStep />}
      {step === 3 && <StandingsStep t={t} />}
    </DemoCard>
  )
}

function Bar({ fraction, fill }: { fraction: number; fill: string }) {
  return (
    <div
      style={{
        width: 'min(60%, 220px)',
        height: 8,
        borderRadius: 4,
        border: border.thin,
        overflow: 'hidden',
        background: color.white,
        flexShrink: 0,
      }}
    >
      <div style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, height: '100%', background: fill }} />
    </div>
  )
}

function FlashStep({ t }: { t: number }) {
  return (
    <>
      <div style={sceneBox}>
        <div style={{ width: '100%', height: '100%', animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)' }}>
          <IsoScene boxes={SCENE} />
        </div>
      </div>
      <div style={{ ...caption, color: color.ink }}>Remember them all!</div>
      {/* The scene's time on screen runs out. */}
      <Bar fraction={1 - t / HIDE_AT} fill={color.yellow} />
    </>
  )
}

function AnswerStep({ t }: { t: number }) {
  const since = t - HIDE_AT
  const typed = t >= TYPE_AT ? String(ANSWER) : ''
  const entered = t >= ENTER_AT
  const pressing = entered && t < ENTER_AT + 220
  const used = Math.min(since, ENTER_AT - HIDE_AT) / (ENTER_AT - HIDE_AT) * TIME_USED_AT_ENTER
  const timeLeft = 1 - used
  const caretOn = !entered && Math.floor(since / 450) % 2 === 0

  return (
    <>
      <div
        style={{
          ...sceneBox,
          height: stageSize(84, 42, 150),
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: stageSize(64, 36, 120),
          lineHeight: 1,
          color: color.mutedSoft,
          animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        ?
      </div>
      <div style={label}>HOW MANY BLOCKS?</div>
      <Bar fraction={timeLeft} fill={timeLeft < 0.3 ? color.red : color.mint} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: stageSize(110, 56, 170),
            boxSizing: 'border-box',
            textAlign: 'center',
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: stageSize(26, 13, 40),
            lineHeight: 1.2,
            padding: '2px 8px',
            background: color.white,
            border: border.medium,
            borderRadius: 14,
            color: typed ? color.ink : color.mutedSoft,
          }}
        >
          {typed ? (
            <span key="typed" style={{ display: 'inline-block', animation: 'pa-pop .3s cubic-bezier(.34,1.56,.64,1)' }}>
              {typed}
            </span>
          ) : null}
          <span style={{ opacity: caretOn ? 1 : 0, color: color.ink, marginLeft: 1 }}>|</span>
        </div>
        <div
          style={{
            background: color.mint,
            color: color.mintInk,
            borderRadius: 10,
            padding: `${stageSize(6, 3, 10)} ${stageSize(10, 5, 16)}`,
            fontWeight: 900,
            fontSize: stageSize(11, 5.5, 16),
            letterSpacing: '0.08em',
            boxShadow: lift(pressing ? 2 : 4),
            transform: pressing ? 'translateY(2px)' : 'none',
            transition: 'transform .08s ease, box-shadow .08s ease, opacity .2s ease',
            // The key only shows up once there is something to send.
            opacity: typed ? 1 : 0.35,
            whiteSpace: 'nowrap',
          }}
        >
          ENTER ↵
        </div>
      </div>
    </>
  )
}

function CheckStep() {
  return (
    <>
      <div style={sceneBox}>
        <IsoScene boxes={SCENE} />
      </div>
      <div
        style={{
          ...caption,
          fontSize: stageSize(20, 10, 30),
          color: color.mintInk,
          animation: 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        Yes — {ANSWER}!
      </div>
    </>
  )
}

function StandingsStep({ t }: { t: number }) {
  const since = t - STANDINGS_AT

  return (
    <>
      <div style={label}>AFTER 8 PUZZLES</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: stageSize(340, 140, 480) }}>
        <DemoRow place="1st" name="You" note="7 right · 18.4s" gain="+1" highlight visible={since > 300} />
        <DemoRow place="2nd" name="Sam" note="7 right · 24.9s" gain="—" visible={since > 600} />
        <DemoRow place="3rd" name="Alex" note="5 right · 11.2s" gain="—" visible={since > 900} />
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: fluid(12, 13),
          color: color.mutedStrong,
          opacity: since > 1400 ? 1 : 0,
          transition: 'opacity .3s ease',
        }}
      >
        Same score? The faster answers win.
      </div>
    </>
  )
}
