import type { CSSProperties } from 'react'
import { border, color, fluid, font, lift, sharedStyles } from '../../theme/index.ts'
import { DemoCard, DemoRow } from '../demo/DemoKit.tsx'
import { stepAt, useLoopTime } from '../demo/demoLoop.ts'
import { stageSize } from '../demo/stageSize.ts'

/**
 * The round, played on a loop in miniature: the target rolls and lands, the
 * clock runs and a tap stops it, and the closest stop takes the point. It
 * stands in for the written rules on the reveal screen — watching one round
 * says more than a paragraph about one.
 *
 * Every frame is derived from the time into the loop, so it never drifts and
 * can be dropped in or out of the page at any moment.
 */

/** Timeline, in ms into the loop. */
const SPIN_END = 1_500
/** The landed target holds for a beat, so it can be read before the clock starts. */
const TARGET_END = 3_300
/** The tap lands here; the clock freezes on it. */
const TAP_AT = 6_000
/** The stopped clock holds for a beat too, so the stop can be read before it is scored. */
const RESULT_AT = 7_500
const LOOP_MS = 11_000

const TARGET_S = 5
/** Where the demo player stops the clock: close, not perfect. */
const STOPPED_S = 4.97
/** Runs faster than real time so the demo does not drag. */
const CLOCK_RATE = STOPPED_S / ((TAP_AT - TARGET_END) / 1000)
/** Matches the real spin, so the demo rolls at the speed the game does. */
const SPIN_FRAME_MS = 110

const RIVAL = { name: 'Sam', offS: 0.41 }

const STEPS = ['Target lands', 'Stop the clock', 'Closest wins'] as const

/**
 * Deterministic decoy per spin frame, 1–10. Stepping by 7 (coprime with 10)
 * never repeats the previous value, so the roll never looks frozen.
 */
const decoyAt = (frame: number): number => 1 + ((frame * 7 + 3) % 10)

export function StopTheClockDemo() {
  const t = useLoopTime(LOOP_MS)
  const { step, progress } = stepAt(t, [0, TARGET_END, RESULT_AT], LOOP_MS)

  return (
    <DemoCard
      steps={STEPS}
      step={step}
      progress={progress}
      ariaLabel="How it works: a target lands, you stop the clock as close to it as you can, and the closest stop wins the point."
      footnote="Last two rounds, the clock fades out halfway — you count the rest in your head."
    >
      {step === 0 && <TargetStep t={t} />}
      {step === 1 && <ClockStep t={t} />}
      {step === 2 && <ResultStep t={t} />}
    </DemoCard>
  )
}

const label = (playing: boolean): CSSProperties => ({
  ...sharedStyles.microLabel,
  letterSpacing: '0.22em',
  fontSize: playing ? stageSize(14, 7, 22) : stageSize(10, 5, 15),
  color: playing ? color.ink : color.mutedStrong,
  whiteSpace: 'nowrap',
})

const bigNumber: CSSProperties = {
  fontFamily: font.display,
  fontWeight: 700,
  fontSize: stageSize(52, 26, 104),
  lineHeight: 1,
  letterSpacing: '-0.02em',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

function TargetStep({ t }: { t: number }) {
  const spinning = t < SPIN_END
  return (
    <>
      <div style={label(false)}>{spinning ? 'PICKING A TARGET' : 'STOP AT'}</div>
      <div
        key={spinning ? 'spin' : 'landed'}
        style={{
          ...bigNumber,
          color: spinning ? color.mutedSoft : color.ink,
          animation: spinning ? undefined : 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        {spinning ? decoyAt(Math.floor(t / SPIN_FRAME_MS)) : TARGET_S}s
      </div>
    </>
  )
}

function ClockStep({ t }: { t: number }) {
  const stopped = t >= TAP_AT
  const elapsed = stopped ? STOPPED_S : ((t - TARGET_END) / 1000) * CLOCK_RATE
  // The finger arrives a beat before the tap, so the press reads as deliberate.
  const fingerIn = t >= TAP_AT - 700
  const pressed = t >= TAP_AT && t < TAP_AT + 220

  return (
    <>
      <div style={label(true)}>STOP AT {TARGET_S}s</div>
      <div style={{ ...bigNumber, color: stopped ? color.mutedStrong : color.ink }}>
        {elapsed.toFixed(2)}s
      </div>
      <div style={{ position: 'relative', marginTop: 4 }}>
        <div
          style={{
            background: color.mint,
            color: color.mintInk,
            borderRadius: 12,
            padding: `${stageSize(8, 4, 14)} ${stageSize(36, 18, 64)}`,
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: stageSize(17, 8, 26),
            boxShadow: lift(pressed ? 2 : 5),
            transform: pressed ? 'translateY(3px)' : 'none',
            transition: 'transform .08s ease, box-shadow .08s ease',
            opacity: stopped && !pressed ? 0.45 : 1,
          }}
        >
          STOP
        </div>
        {pressed && (
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 56,
              height: 56,
              margin: '-28px 0 0 -28px',
              borderRadius: 999,
              border: `3px solid ${color.pink}`,
              animation: 'pa-demo-ripple .45s ease-out both',
              pointerEvents: 'none',
            }}
          />
        )}
        <Finger visible={fingerIn} pressing={pressed} />
      </div>
    </>
  )
}

function Finger({ visible, pressing }: { visible: boolean; pressing: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={30}
      height={30}
      aria-hidden
      style={{
        position: 'absolute',
        left: '58%',
        top: '55%',
        opacity: visible ? 1 : 0,
        transform: visible
          ? `translate(0, ${pressing ? -2 : 0}px) scale(${pressing ? 0.9 : 1})`
          : 'translate(26px, 30px)',
        transition: 'opacity .25s ease, transform .3s ease',
        pointerEvents: 'none',
        filter: `drop-shadow(0 2px 0 ${color.ink})`,
      }}
    >
      <path
        d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10l.4-.1a1.5 1.5 0 0 1 1.9 1l.1.3.5-.1a1.5 1.5 0 0 1 1.8 1.1l.5-.1a1.5 1.5 0 0 1 1.8 1.5V17a5 5 0 0 1-5 5h-1.3a5 5 0 0 1-4-2l-2.9-3.9a1.5 1.5 0 0 1 2.2-2L9 15.5z"
        fill={color.white}
        stroke={color.ink}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ResultStep({ t }: { t: number }) {
  const since = t - RESULT_AT
  const offS = Math.abs(TARGET_S - STOPPED_S)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: fluid(8, 12), flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ ...bigNumber, fontSize: stageSize(36, 18, 64), color: color.mutedStrong }}>
          {STOPPED_S.toFixed(2)}s
        </div>
        <div
          style={{
            background: color.yellow,
            border: border.thin,
            borderRadius: 999,
            padding: '4px 12px',
            fontWeight: 900,
            fontSize: stageSize(12, 6, 17),
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            animation: 'pa-pop .4s cubic-bezier(.34,1.56,.64,1) both',
          }}
        >
          {offS.toFixed(2)}s OFF
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: stageSize(320, 130, 460) }}>
        <DemoRow place="1st" name="You" note={`${offS.toFixed(2)}s off`} gain="+1" highlight visible={since > 350} />
        <DemoRow place="2nd" name={RIVAL.name} note={`${RIVAL.offS.toFixed(2)}s off`} gain="—" visible={since > 650} />
      </div>
    </>
  )
}
