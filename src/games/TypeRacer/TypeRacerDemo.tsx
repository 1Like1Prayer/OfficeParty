import type { CSSProperties } from 'react'
import { TYPE_RACER } from '../../shared/games/typeRacer/constants.ts'
import { border, color, font, sharedStyles } from '../../theme/index.ts'
import { DemoCard, DemoRow } from '../demo/DemoKit.tsx'
import { stepAt, useLoopTime } from '../demo/demoLoop.ts'
import { stageSize } from '../demo/stageSize.ts'

/**
 * The race, played on a loop in miniature: a sheet of the game's own paper
 * over the player's wooden block above the sea. An easy line is typed out; on
 * a hard paragraph a typo sends the line back to its start and costs a strike;
 * three strikes roll the die, a heart buys another go with a deadlier die, and
 * a skull crumbles the block. The first to finish takes the point. It stands
 * in for the written rules on the reveal screen.
 *
 * Every frame is derived from the time into the loop, so it never drifts and
 * can be dropped in or out of the page at any moment.
 */

/** Timeline, in ms into the loop. */
const TYPO_STEP_AT = 3_600
const ROLL_STEP_AT = 7_400
const SKULL_STEP_AT = 11_400
const STANDINGS_AT = 15_800
const LOOP_MS = 19_400

const KEY_MS = 115
/** How long the die tumbles before it lands. */
const TUMBLE_MS = 1_150
const CRUMBLE_MS = 1_500

const { STRIKES_TO_ROLL, STRIKES_AFTER_SURVIVING, DICE_SIDES, STARTING_SKULLS } = TYPE_RACER
const PARAGRAPHS = 5
const EASY_PARAGRAPHS = 2

const TYPEWRITER = "'Courier Prime', 'Courier New', ui-monospace, monospace"
const PAPER = '#FBF6E4'
const WOOD = '#B98446'
const WOOD_DARK = '#7A5126'
const SEA = '#2B86D1'
const SEA_LIGHT = '#7CC4F5'

const EASY_LINES = ['Tea first, then work.', 'Mind the printer.'] as const
const HARD_LINES = ['Re-align Q3 synergy!', 'Per @Dana: ship it?'] as const

const STEPS = ['Type each line', 'Typo = restart', '3 strikes = dice', 'Skull = out', 'First one wins'] as const

/** One typing run on a line: keys from `from`, one every KEY_MS, and a wrong key after `wrongAfter` right ones. */
interface Run {
  from: number
  wrongAfter?: number
}

/** The second run in the typo step, after the line has started over. */
const RETYPE_AT = 6_000
const TYPO_RUN: Run = { from: 4_000, wrongAfter: 12 }
const ROLL_RUN: Run = { from: 7_700, wrongAfter: 5 }
const SKULL_RUN: Run = { from: 11_700, wrongAfter: 3 }

const wrongAt = (run: Run): number => run.from + (run.wrongAfter ?? 0) * KEY_MS
/** How long a wrong key shows in red before the line starts over (or the die comes out). */
const WRONG_KEY_MS = 500
const ROLL_AT = wrongAt(ROLL_RUN) + WRONG_KEY_MS
const SKULL_ROLL_AT = wrongAt(SKULL_RUN) + WRONG_KEY_MS

/** Where each roll lands, as a die face: the lowest faces are the skulls. */
const HEART_FACE = 4
const SKULL_FACE = 2

export function TypeRacerDemo() {
  const t = useLoopTime(LOOP_MS)
  const { step, progress } = stepAt(t, [0, TYPO_STEP_AT, ROLL_STEP_AT, SKULL_STEP_AT, STANDINGS_AT], LOOP_MS)

  return (
    <DemoCard
      steps={STEPS}
      step={step}
      progress={progress}
      ariaLabel="How it works: everyone types the same paragraphs, one or two easy ones and then three hard ones. A wrong key sends you back to the start of the line and costs a strike. Three strikes roll a die: a heart lets you carry on with two strikes and a deadlier die, a skull crumbles your block. The first to finish wins."
      footnote={`1–2 easy warm-ups, then 3 hard paragraphs, ${TYPE_RACER.PARAGRAPH_TIME_LIMIT_MS / 60_000} minutes each. Every heart you survive adds a skull to the die, and it never resets.`}
    >
      {step === 4 ? <StandingsStep t={t} /> : <RaceStep t={t} step={step} />}
    </DemoCard>
  )
}

interface LineView {
  text: string
  typed: number
  isCurrent: boolean
  isDone: boolean
  /** A wrong key just pressed, shown in red where the right one should have gone. */
  wrongKey?: string
}

/** How many keys of `run` are in by `t` on a line `length` long, stopping at the wrong one. */
function keysIn(t: number, run: Run, length: number): number {
  if (t < run.from) return 0
  const pressed = Math.floor((t - run.from) / KEY_MS) + 1
  return Math.min(length, run.wrongAfter ?? length, pressed)
}

function RaceStep({ t, step }: { t: number; step: number }) {
  const isHard = step > 0
  const lines = isHard ? HARD_LINES : EASY_LINES
  let views: LineView[]
  let strikes = 0
  let mistakeAt: number | null = null
  let roll: { at: number; face: number; skulls: number } | null = null

  if (step === 0) {
    // The easy warm-up: the first line typed out, and on into the next.
    const first = keysIn(t, { from: 400 }, lines[0].length)
    const secondFrom = 400 + lines[0].length * KEY_MS + 250
    const second = keysIn(t, { from: secondFrom }, lines[1].length)
    const onSecond = t >= secondFrom
    views = [
      { text: lines[0], typed: first, isCurrent: !onSecond, isDone: onSecond },
      { text: lines[1], typed: second, isCurrent: onSecond, isDone: false },
    ]
  } else {
    // On a hard paragraph: a typo throws the line back to its first letter.
    const run = step === 1 ? TYPO_RUN : step === 2 ? ROLL_RUN : SKULL_RUN
    const wrong = wrongAt(run)
    const restarted = t >= wrong + WRONG_KEY_MS
    const typed = step === 1 && t >= RETYPE_AT
      ? keysIn(t, { from: RETYPE_AT }, lines[0].length)
      : restarted ? 0 : keysIn(t, run, lines[0].length)
    const isShowingWrongKey = t >= wrong && !restarted
    views = [
      { text: lines[0], typed, isCurrent: true, isDone: false, wrongKey: isShowingWrongKey ? 'x' : undefined },
      { text: lines[1], typed: 0, isCurrent: false, isDone: false },
    ]
    if (t >= wrong) mistakeAt = wrong

    const before = step === 1 ? 0 : STRIKES_AFTER_SURVIVING
    strikes = t >= wrong ? before + 1 : before

    if (step === 2 || step === 3) {
      const isSkullStep = step === 3
      roll = {
        at: isSkullStep ? SKULL_ROLL_AT : ROLL_AT,
        face: isSkullStep ? SKULL_FACE : HEART_FACE,
        skulls: STARTING_SKULLS + (isSkullStep ? 1 : 0),
      }
      const landed = t >= roll.at + TUMBLE_MS
      if (landed && !isSkullStep) {
        // A heart: back to two strikes, and the next die has another skull.
        strikes = STRIKES_AFTER_SURVIVING
      }
    }
  }

  const crumble =
    step === 3 && t >= SKULL_ROLL_AT + TUMBLE_MS + 200
      ? Math.min(1, (t - (SKULL_ROLL_AT + TUMBLE_MS + 200)) / CRUMBLE_MS)
      : 0
  const paragraph = isHard ? EASY_PARAGRAPHS + 1 : 1

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: stageSize(300, 150, 560),
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: stageSize(4, 2, 8),
      }}
    >
      <StageChips current={paragraph} />
      {/* Kept free for the die, so it never covers the sheet, its strikes, or the typist below. */}
      <div
        style={{
          height: stageSize(50, 26, 96),
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: stageSize(3, 1.5, 6),
        }}
      >
        {roll !== null && t >= roll.at && <Die t={t} roll={roll} fade={crumble} />}
      </div>
      <Paper
        paragraph={paragraph}
        isHard={isHard}
        strikes={strikes}
        lines={views}
        mistakeAt={mistakeAt}
        isWaiting={roll !== null && t >= roll.at}
        crumble={crumble}
        clockSeconds={Math.max(0, 180 - Math.floor(t / 1000) - (isHard ? 40 : 0))}
      />
      <Block t={t} isTyping={roll === null || t < roll.at} crumble={crumble} />
    </div>
  )
}

/** The race's paragraphs as chips: the easy warm-ups, then the hard ones, the current one lit. */
function StageChips({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: stageSize(3, 1.5, 6) }}>
      {Array.from({ length: PARAGRAPHS }, (_, index) => {
        const number = index + 1
        const isEasy = number <= EASY_PARAGRAPHS
        const isCurrent = number === current
        return (
          <span
            key={number}
            style={{
              ...sharedStyles.microLabel,
              fontSize: stageSize(8, 4, 12),
              letterSpacing: '0.08em',
              padding: `${stageSize(2, 1, 4)} ${stageSize(5, 2.5, 10)}`,
              borderRadius: 999,
              border: isCurrent ? `2px solid ${color.ink}` : border.thin,
              background: isCurrent ? color.yellow : isEasy ? '#D9F7EC' : '#FFE0EE',
              color: color.ink,
              opacity: number < current ? 0.55 : 1,
              whiteSpace: 'nowrap',
              transition: 'background .2s',
            }}
          >
            {number < current ? '✓' : number} {isEasy ? 'EASY' : 'HARD'}
          </span>
        )
      })}
    </div>
  )
}

interface PaperProps {
  paragraph: number
  isHard: boolean
  strikes: number
  lines: LineView[]
  /** When the last wrong key was pressed, so the sheet flashes once for it. */
  mistakeAt: number | null
  /** The die is out: typing waits on it. */
  isWaiting: boolean
  crumble: number
  clockSeconds: number
}

/** The game's sheet of paper in miniature: header, strikes, and the lines being typed. */
function Paper({ paragraph, isHard, strikes, lines, mistakeAt, isWaiting, crumble, clockSeconds }: PaperProps) {
  const text = stageSize(11, 5.6, 19)
  return (
    <div
      style={{
        background: PAPER,
        border: `2px solid ${color.ink}`,
        borderRadius: 12,
        boxShadow: `0 4px 0 ${color.ink}`,
        overflow: 'hidden',
        textAlign: 'left',
        // The race is over for this player: their sheet fades as they go in.
        opacity: 1 - crumble * 0.75,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: `${stageSize(3, 1.5, 6)} ${stageSize(8, 4, 14)}`,
          background: color.yellowSoft,
          borderBottom: border.thin,
        }}
      >
        <span style={{ ...sharedStyles.microLabel, fontSize: stageSize(8, 4, 12), color: color.ink, whiteSpace: 'nowrap' }}>
          ¶ {paragraph}/{PARAGRAPHS} · {isHard ? 'HARD' : 'EASY'}
        </span>
        <Strikes strikes={strikes} />
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: stageSize(11, 5.5, 18), color: color.ink }}>
          {Math.floor(clockSeconds / 60)}:{String(clockSeconds % 60).padStart(2, '0')}
        </span>
      </div>

      <div
        // Remounted for each wrong key, so the game's own red flash plays once for it.
        key={mistakeAt ?? 'none'}
        style={{
          padding: `${stageSize(5, 2.5, 10)} ${stageSize(8, 4, 16)}`,
          fontFamily: TYPEWRITER,
          fontSize: text,
          lineHeight: 1.55,
          animation: mistakeAt === null ? undefined : 'pa-type-mistake 500ms ease-out',
          opacity: isWaiting ? 0.45 : 1,
          transition: 'opacity .25s',
        }}
      >
        {lines.map((line) => (
          <div
            key={line.text}
            style={{
              whiteSpace: 'pre',
              color: line.isDone ? color.mintInk : color.ink,
              opacity: line.isDone ? 0.55 : line.isCurrent ? 1 : 0.6,
              fontWeight: line.isCurrent ? 700 : 500,
              borderLeft: `3px solid ${line.isCurrent ? color.red : 'transparent'}`,
              paddingLeft: stageSize(5, 2.5, 9),
            }}
          >
            <span style={{ color: color.mintInk }}>{line.text.slice(0, line.isDone ? line.text.length : line.typed)}</span>
            {line.isCurrent && !isWaiting && line.typed < line.text.length && (
              <span
                style={{
                  background: line.wrongKey ? color.red : color.yellow,
                  color: line.wrongKey ? color.white : undefined,
                  boxShadow: `0 2px 0 ${color.ink}`,
                  borderRadius: 3,
                }}
              >
                {line.wrongKey ?? (line.text[line.typed] === ' ' ? ' ' : line.text[line.typed])}
              </span>
            )}
            <span>{line.isDone ? '' : line.text.slice(line.isCurrent && !isWaiting ? line.typed + 1 : line.typed)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The game's three strike pips, filling red. */
function Strikes({ strikes }: { strikes: number }) {
  const size = stageSize(11, 5.5, 18)
  return (
    <span style={{ display: 'flex', gap: stageSize(2, 1, 5) }} aria-label={`${strikes} strikes`}>
      {Array.from({ length: STRIKES_TO_ROLL }, (_, index) => (
        <span
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: border.thin,
            background: index < strikes ? color.red : color.white,
            color: color.white,
            fontSize: stageSize(7, 3.5, 11),
            fontWeight: 900,
            display: 'grid',
            placeItems: 'center',
            transition: 'background .15s',
            animation: index === strikes - 1 ? 'pa-pop .35s ease-out' : undefined,
          }}
        >
          {index < strikes ? '✕' : ''}
        </span>
      ))}
    </span>
  )
}

/*
 * The scene at the foot of the stage, in its own units: the sea, the player's
 * wooden block on it, their typewriter, and the typist sitting at it. The SVG
 * is fitted to its strip's height and the sea runs far past the sides.
 */
const SCENE_W = 200
const SCENE_H = 64
const WATER_Y = 50
const BLOCK = { x: 66, y: 36, w: 68, h: 14 } as const
const SEAT_X = 84
const SHIRT = '#FF7A2E'
const SKIN = '#FFE0B8'
const KEYS = '#2E2A45'

interface BlockProps {
  t: number
  /** Hands on the keys, bobbing as they type. */
  isTyping: boolean
  /** 0 standing, to 1 gone: the block breaks up and the typist goes into the sea. */
  crumble: number
}

/**
 * The player's wooden block over the sea, with the typist sitting at their
 * typewriter on it. On a skull the block breaks apart, the typewriter goes
 * over the side, and the typist tumbles into the water with a splash.
 */
function Block({ t, isTyping, crumble }: BlockProps) {
  const pieces = 5
  const pieceW = BLOCK.w / pieces
  const swell = (t * 0.02) % 40
  const stroke = { stroke: color.ink, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  // The typist: a beat behind the block, up in alarm, then over and down into the sea.
  const fall = Math.max(0, Math.min(1, (crumble - 0.08) / 0.75))
  const drop = fall * fall * 46
  const spin = fall * -150
  const isUnder = fall > 0.62
  const sink = isUnder ? (fall - 0.62) / 0.38 : 0
  // Hands tap the keys while typing; up and flailing once the block goes.
  const tap = isTyping && crumble === 0 ? Math.abs(Math.sin(t / 70)) * 1.6 : 0
  const handY = crumble > 0 ? 6 - fall * 10 : 26 - tap
  const handX = crumble > 0 ? SEAT_X + 6 : SEAT_X + 20
  // The splash, as the typist hits the water.
  const splash = fall > 0.55 ? Math.min(1, (fall - 0.55) / 0.45) : 0

  return (
    <div style={{ position: 'relative', height: stageSize(50, 28, 104), flexShrink: 0 }}>
      <svg
        viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        preserveAspectRatio="xMidYMax meet"
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          {/* What is above the waterline: the typist vanishes below it. */}
          <clipPath id="tr-demo-above-water">
            <rect x={-1000} y={-1000} width={2000 + SCENE_W} height={1000 + WATER_Y + 1} />
          </clipPath>
        </defs>

        {/* The block, in pieces that fall away one after another. */}
        {Array.from({ length: pieces }, (_, index) => {
          const pieceDrop = Math.max(0, Math.min(1, crumble * 1.6 - index * 0.12))
          const x = BLOCK.x + index * pieceW
          const turn = (index % 2 === 0 ? 1 : -1) * pieceDrop * 40
          return (
            <g
              key={index}
              clipPath="url(#tr-demo-above-water)"
              opacity={1 - pieceDrop * 0.6}
            >
              <g transform={`translate(0 ${pieceDrop * pieceDrop * 30}) rotate(${turn} ${x + pieceW / 2} ${BLOCK.y + BLOCK.h / 2})`}>
                <rect x={x} y={BLOCK.y} width={pieceW} height={BLOCK.h} fill={WOOD} {...stroke} />
                <line x1={x + 3} x2={x + pieceW - 3} y1={BLOCK.y + 5} y2={BLOCK.y + 5} stroke={WOOD_DARK} strokeWidth={1} />
                <line x1={x + 5} x2={x + pieceW - 2} y1={BLOCK.y + 9.5} y2={BLOCK.y + 9.5} stroke={WOOD_DARK} strokeWidth={1} />
              </g>
            </g>
          )
        })}

        {/* The typewriter, over the side with the block. */}
        <g clipPath="url(#tr-demo-above-water)">
          <g transform={`translate(0 ${crumble * crumble * 34}) rotate(${crumble * 35} 112 30)`}>
            <rect x={104} y={14} width={13} height={10} rx={1} fill="#FFFFFF" {...stroke} strokeWidth={1.2} />
            <rect x={100} y={23} width={22} height={13} rx={3} fill={KEYS} {...stroke} />
            <line x1={103} x2={119} y1={31} y2={31} stroke="#8B84A6" strokeWidth={1.4} strokeDasharray="2 1.5" />
          </g>
        </g>

        {/* The typist, sitting on the block at the keys. */}
        <g clipPath="url(#tr-demo-above-water)" opacity={1 - sink}>
          <g transform={`translate(${fall * -6} ${drop}) rotate(${spin} ${SEAT_X} 30)`}>
            {/* Legs folded on the block. */}
            <path d={`M ${SEAT_X} 34 L ${SEAT_X + 11} 34 L ${SEAT_X + 12} 36`} fill="none" {...stroke} strokeWidth={3.2} />
            {/* Body, leaning in to type. */}
            <rect x={SEAT_X - 5} y={17} width={11} height={18} rx={4} fill={SHIRT} {...stroke} />
            {/* Arms out to the keys, or up in alarm. */}
            <line x1={SEAT_X + 2} y1={21} x2={handX} y2={handY} {...stroke} strokeWidth={2.4} />
            <line x1={SEAT_X - 1} y1={21} x2={handX - 3} y2={handY + (crumble > 0 ? 2 : 1)} {...stroke} strokeWidth={2.4} />
            <circle cx={SEAT_X + 1} cy={11} r={6} fill={SKIN} {...stroke} />
            <path d={`M ${SEAT_X - 5} 9 Q ${SEAT_X + 1} 2 ${SEAT_X + 7} 9`} fill="none" {...stroke} strokeWidth={2.6} />
            <circle cx={SEAT_X + 4} cy={10} r={0.9} fill={color.ink} />
            {/* A wide-open mouth once they are going over. */}
            {crumble > 0 && <circle cx={SEAT_X + 5} cy={14} r={1.3} fill={color.ink} />}
          </g>
        </g>

        {/* The sea, drawn over the foot of everything so what falls in goes under. */}
        <rect x={-1000} y={WATER_Y} width={2000 + SCENE_W} height={60} fill={SEA} />
        <line x1={-1000} x2={1000 + SCENE_W} y1={WATER_Y} y2={WATER_Y} stroke={color.ink} strokeWidth={1.6} />
        {[WATER_Y + 5, WATER_Y + 10].map((y, index) => (
          <line
            key={y}
            x1={-1000}
            x2={1000 + SCENE_W}
            y1={y}
            y2={y}
            stroke={SEA_LIGHT}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeDasharray="8 14"
            strokeDashoffset={index === 0 ? swell : -swell}
          />
        ))}

        {/* The splash. */}
        {splash > 0 && splash < 1 && (
          <g opacity={1 - splash}>
            <ellipse cx={SEAT_X - 4} cy={WATER_Y} rx={6 + splash * 22} ry={2 + splash * 5} fill="none" stroke="#FFFFFF" strokeWidth={1.6} />
            {[-1, -0.4, 0.4, 1].map((side) => (
              <circle
                key={side}
                cx={SEAT_X - 4 + side * (4 + splash * 14)}
                cy={WATER_Y - Math.sin(splash * Math.PI) * 14 * (1.2 - Math.abs(side) * 0.4)}
                r={1.6}
                fill="#FFFFFF"
                stroke={color.ink}
                strokeWidth={0.6}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}

/** The die: tumbling through its faces, then landing. Skulls are the lowest faces. */
function Die({ t, roll, fade }: { t: number; roll: { at: number; face: number; skulls: number }; fade: number }) {
  const since = t - roll.at
  const landed = since >= TUMBLE_MS
  const face = landed ? roll.face : (Math.floor(since / 90) % DICE_SIDES) + 1
  const isSkull = (side: number) => side <= roll.skulls
  const spin = landed ? 0 : (since / 90) * 37
  const size = stageSize(30, 15, 54)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: stageSize(6, 3, 12),
        pointerEvents: 'none',
        opacity: 1 - fade,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          border: `3px solid ${color.ink}`,
          background: landed ? (isSkull(face) ? color.red : color.white) : color.white,
          boxShadow: `0 4px 0 ${color.ink}`,
          display: 'grid',
          placeItems: 'center',
          fontSize: stageSize(20, 10, 36),
          lineHeight: 1,
          color: isSkull(face) ? (landed ? color.white : color.ink) : color.pink,
          transform: `rotate(${spin}deg) scale(${landed ? 1.08 : 1})`,
          animation: landed ? 'pa-pop .4s cubic-bezier(.34,1.56,.64,1)' : undefined,
        }}
      >
        {isSkull(face) ? '☠' : '♥'}
      </div>
      {/* What is on the die this time: skulls first, then hearts. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: `${stageSize(2, 1, 3)} ${stageSize(6, 3, 10)}`,
          borderRadius: 999,
          border: border.thin,
          background: color.white,
          fontSize: stageSize(10, 5, 15),
          lineHeight: 1.2,
        }}
      >
        {Array.from({ length: DICE_SIDES }, (_, index) => (
          <span key={index} style={{ color: isSkull(index + 1) ? color.ink : color.pink }}>
            {isSkull(index + 1) ? '☠' : '♥'}
          </span>
        ))}
        <span style={{ ...sharedStyles.microLabel, fontSize: stageSize(7, 3.5, 11), color: color.mutedStrong, marginLeft: 4 }}>
          {roll.skulls} {roll.skulls === 1 ? 'SKULL' : 'SKULLS'}
        </span>
      </div>
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
      <div style={label}>FIRST TO FINISH WINS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: stageSize(340, 140, 480) }}>
        <DemoRow place="1st" name="Sam" note="finished 5/5" gain="+1" highlight visible={since > 300} />
        <DemoRow place="2nd" name="You" note="skull on ¶ 3" gain="—" visible={since > 600} />
        <DemoRow place="3rd" name="Alex" note="out of time on ¶ 2" gain="—" visible={since > 900} />
      </div>
    </>
  )
}
